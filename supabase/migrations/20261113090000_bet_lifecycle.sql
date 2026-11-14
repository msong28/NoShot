-- Bet lifecycle fixes: proposed -> active -> who won -> settle up.
--
-- 1. Changing an active bet needs the other side's consent, and saying no to
--    a change no longer kills the bet. Before this, propose_bet_amendment()
--    rewrote the live bet row and flipped it back to pending_acceptance, so a
--    decline went through approve_bet_version()'s "decline voids the bet"
--    branch -- turning down an edit cancelled an agreed bet. Now a change is
--    a row in bet_amendments; the bet stays active on its agreed terms until
--    the other participant accepts, and a decline only closes the request.
--    create_or_counter_bet() refuses to touch an active bet unless it is being
--    called from respond_to_bet_amendment() (transaction-local
--    noshot.amendment_apply flag, which clients have no way to set).
--
-- 2. "Who won?" is report-then-confirm (option C in CHANGELOG_WEB.md), replacing
--    one-person-final settlement for participant_submission bets:
--    - Reporting that you LOST finalizes immediately (admitting a loss needs
--      no check).
--    - Reporting that you won, or a tie, puts the bet in pending_result. The
--      other side can confirm (final) or dispute. If they do nothing for
--      bet_result_confirm_window(), the report locks in automatically.
--    - Once disputed, either side can report a different result (a claim the
--      other side already rejected can't be pushed again) or call the bet off
--      -- voided, nothing owed. A reply-report while a result is pending
--      counts as disputing it.
--    The ledger obligation is only posted when the result is final, so no
--    reversal entries are ever needed for a disputed report.
--    judge / group_vote bets keep their original behaviour untouched.
--
-- 3. Voided bets say why: declined / withdrawn / cancelled / called_off /
--    expired (bets.void_reason). A trigger fills the first three from the
--    approval rows the existing RPCs already write, so those RPCs don't need
--    to be redefined; call_off_bet() and expiry set theirs explicitly.
--
-- 4. Proposals nobody answers expire after bet_proposal_expiry() (voided,
--    'expired'), and overdue pending results lock in. Both happen in
--    _finalize_due_bets(): called lazily by the client through
--    finalize_due_bets() whenever a user loads their bets, and also scheduled
--    with pg_cron when that extension is installed.
--
-- Also restores the submit_bet_result rate limit that 20260726090000 dropped
-- when it redefined the function.

-- ---------------------------------------------------------------------------
-- Tunables (one place to change them)
-- ---------------------------------------------------------------------------
create function public.bet_result_confirm_window () returns interval language sql immutable as $$
  select interval '48 hours'
$$;

create function public.bet_proposal_expiry () returns interval language sql immutable as $$
  select interval '7 days'
$$;

-- ---------------------------------------------------------------------------
-- New bet columns
-- ---------------------------------------------------------------------------
alter table public.bets
add column void_reason text,
add column result_reported_by uuid references public.profiles (id) on delete set null,
add column result_due_at timestamptz,
-- The report currently waiting for an answer (pending_result) or most
-- recently disputed. Explicit pointer rather than "newest by created_at":
-- two reports can share a timestamp.
add column result_submission_id uuid references public.bet_result_submissions (id) on delete set null,
add constraint bets_void_reason_check check (
  void_reason is null
  or void_reason in ('declined', 'withdrawn', 'cancelled', 'called_off', 'expired')
);

-- Existing voided bets: same inference the trigger below uses.
update public.bets b
set
  void_reason = case
    when exists (
      select 1 from public.bet_approvals a
      where a.bet_id = b.id and a.decision = 'declined'
    ) then 'declined'
    when exists (
      select 1 from public.bet_cancellation_approvals c
      where c.bet_id = b.id and c.decision = 'approved'
    ) then 'cancelled'
    else 'withdrawn'
  end
where b.status = 'voided';

-- approve_bet_version() inserts the declining bet_approvals row before it
-- voids; approve_cancel_bet() leaves its approval rows in place on success;
-- withdraw_bet() writes neither. So the reason is fully determined by what
-- exists at the moment the status flips, unless the caller set one.
create function public._set_bet_void_reason () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  if new.status = 'voided' and old.status is distinct from 'voided' and new.void_reason is null then
    new.void_reason := case
      when exists (
        select 1 from public.bet_approvals a
        where a.bet_id = new.id and a.decision = 'declined'
      ) then 'declined'
      when old.status = 'cancellation_pending' then 'cancelled'
      else 'withdrawn'
    end;
  end if;
  return new;
end;
$$;

create trigger bets_set_void_reason before
update of status on public.bets for each row
execute function public._set_bet_void_reason ();

-- ---------------------------------------------------------------------------
-- Amendments: proposed changes to an active bet
-- ---------------------------------------------------------------------------
create table public.bet_amendments (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  -- The bet version this change was written against. If the bet moves on
  -- (another change accepted), the request is stale and can't be accepted.
  base_version integer not null,
  title text not null,
  description text not null default '',
  deadline timestamptz,
  sides jsonb not null,
  participants jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint bet_amendments_status_check check (
    status in ('pending', 'accepted', 'declined', 'withdrawn')
  )
);

create unique index bet_amendments_one_pending on public.bet_amendments (bet_id)
where
  status = 'pending';

alter table public.bet_amendments enable row level security;

revoke all on public.bet_amendments
from
  anon;

revoke all on public.bet_amendments
from
  authenticated;

grant
select
  on public.bet_amendments to authenticated;

create policy bet_amendments_select on public.bet_amendments for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

-- ---------------------------------------------------------------------------
-- create_or_counter_bet: same as 20260723130000, except
--   * an active bet can only be rewritten from respond_to_bet_amendment()
--   * no "needs your response" push while applying an accepted change
-- ---------------------------------------------------------------------------
create or replace function public.create_or_counter_bet (
  p_bet_id uuid,
  p_group_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz,
  p_resolution_method public.bet_resolution_method,
  p_judge_id uuid,
  p_random_fallback_enabled boolean,
  p_sides jsonb,
  p_participants jsonb,
  p_is_draft boolean default false
) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_version_no integer;
  v_side jsonb;
  v_side_ids jsonb := '{}'::jsonb;
  v_side_id uuid;
  v_commitment jsonb;
  v_currency_id uuid;
  v_first_currency uuid;
  v_participant_id uuid;
  v_payout numeric;
  v_outcome_key text;
  v_winner_payout numeric;
  v_loser_pool numeric;
  v_other_user_id uuid;
  v_applying_amendment boolean :=
    coalesce(current_setting('noshot.amendment_apply', true), '') = 'on';
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('create_bet', 10, interval '1 hour');
  if jsonb_array_length(p_sides) < 2 then
    raise exception 'a bet needs at least two possible outcomes';
  end if;
  if jsonb_array_length(p_participants) < 2 then
    raise exception 'a bet needs at least two participants';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_participants) a
    cross join jsonb_array_elements(p_participants) b
    where (a ->> 'user_id')::uuid <> (b ->> 'user_id')::uuid
      and public.is_blocked_pair((a ->> 'user_id')::uuid, (b ->> 'user_id')::uuid)
  ) then
    raise exception 'this bet includes participants who have blocked each other';
  end if;
  if public.moderate_text(p_title) = 'block' or public.moderate_text(coalesce(p_description, '')) = 'block' then
    raise exception 'that bet''s title or description isn''t allowed';
  end if;

  if p_bet_id is null then
    if not exists (
      select 1 from jsonb_array_elements(p_participants) elem
      where (elem ->> 'user_id')::uuid = auth.uid()
    ) then
      raise exception 'the creator must be a participant';
    end if;
    if p_group_id is not null and not exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'you must be an active member of that group';
    end if;

    insert into public.bets (
      creator_id, group_id, title, description, current_version, status,
      deadline, resolution_method, judge_id, random_fallback_enabled
    )
    values (
      auth.uid(), p_group_id, trim(p_title), coalesce(p_description, ''), 1,
      (case when p_is_draft then 'draft' else 'pending_acceptance' end)::public.bet_status,
      p_deadline, p_resolution_method, p_judge_id, coalesce(p_random_fallback_enabled, false)
    )
    returning * into v_bet;

    v_version_no := 1;
  else
    select * into v_bet from public.bets where id = p_bet_id;
    if v_bet.id is null then
      raise exception 'bet not found';
    end if;
    if not exists (
      select 1 from public.bet_participants where bet_id = p_bet_id and user_id = auth.uid()
    ) then
      raise exception 'only a participant can propose a counteroffer';
    end if;
    if v_bet.status = 'active' and not v_applying_amendment then
      raise exception 'this bet is already agreed -- propose a change instead';
    end if;
    if v_bet.status not in ('draft', 'pending_acceptance', 'active') then
      raise exception 'this bet can no longer be renegotiated';
    end if;

    v_version_no := v_bet.current_version + 1;

    update public.bets
    set title = trim(p_title),
        description = coalesce(p_description, ''),
        current_version = v_version_no,
        status = (case when p_is_draft then 'draft' else 'pending_acceptance' end)::public.bet_status,
        deadline = p_deadline,
        resolution_method = p_resolution_method,
        judge_id = p_judge_id,
        random_fallback_enabled = coalesce(p_random_fallback_enabled, false)
    where id = p_bet_id
    returning * into v_bet;
  end if;

  insert into public.bet_versions (bet_id, version_no, status, created_by, supersedes_version)
  values (
    v_bet.id, v_version_no,
    (case when p_is_draft then 'draft' else 'proposed' end)::public.bet_version_status,
    auth.uid(), nullif(v_version_no - 1, 0)
  );

  for v_side in select jsonb_array_elements(p_sides) loop
    insert into public.bet_sides (bet_id, version_no, label, outcome_key)
    values (v_bet.id, v_version_no, v_side ->> 'label', v_side ->> 'outcome_key')
    returning id into v_side_id;
    v_side_ids := v_side_ids || jsonb_build_object(v_side ->> 'outcome_key', v_side_id::text);
  end loop;

  v_first_currency := null;
  for v_commitment in select jsonb_array_elements(p_participants) loop
    v_currency_id := (v_commitment ->> 'currency_id')::uuid;
    if v_first_currency is null then
      v_first_currency := v_currency_id;
    elsif v_currency_id <> v_first_currency then
      raise exception 'all commitments in a bet must use the same currency';
    end if;
    if not exists (
      select 1 from public.currencies c
      where c.id = v_currency_id
        and c.moderation_status = 'approved'
        and (
          c.is_builtin
          or c.owner_user_id = v_bet.creator_id
          or (c.group_id is not null and c.group_id = v_bet.group_id)
        )
    ) then
      raise exception 'that currency is not available for this bet';
    end if;
    if v_side_ids ->> (v_commitment ->> 'outcome_key') is null then
      raise exception 'unknown outcome for a participant''s commitment';
    end if;

    insert into public.bet_participants (bet_id, user_id, side_id, role)
    values (
      v_bet.id,
      (v_commitment ->> 'user_id')::uuid,
      (v_side_ids ->> (v_commitment ->> 'outcome_key'))::uuid,
      (case when (v_commitment ->> 'user_id')::uuid = v_bet.creator_id then 'creator' else 'participant' end)::public.bet_participant_role
    )
    on conflict (bet_id, user_id) do update
    set side_id = excluded.side_id,
        participation_status = 'active'
    returning id into v_participant_id;

    v_payout := (v_commitment ->> 'stake_quantity')::numeric
      * (v_commitment ->> 'odds_denominator')::numeric
      / (v_commitment ->> 'odds_numerator')::numeric;

    insert into public.bet_commitments (
      bet_id, version_no, participant_id, currency_id, stake_quantity,
      odds_numerator, odds_denominator, payout_if_win
    )
    values (
      v_bet.id, v_version_no, v_participant_id, v_currency_id,
      (v_commitment ->> 'stake_quantity')::numeric,
      (v_commitment ->> 'odds_numerator')::integer,
      (v_commitment ->> 'odds_denominator')::integer,
      v_payout
    );
  end loop;

  -- BET-05: for every possible winning side, its payouts must not exceed
  -- what every other side has staked.
  for v_outcome_key in select jsonb_object_keys(v_side_ids) loop
    select coalesce(sum(bc.payout_if_win), 0) into v_winner_payout
    from public.bet_commitments bc
    join public.bet_participants bp on bp.id = bc.participant_id
    join public.bet_sides bs on bs.id = bp.side_id
    where bc.bet_id = v_bet.id and bc.version_no = v_version_no and bs.outcome_key = v_outcome_key;

    select coalesce(sum(bc.stake_quantity), 0) into v_loser_pool
    from public.bet_commitments bc
    join public.bet_participants bp on bp.id = bc.participant_id
    join public.bet_sides bs on bs.id = bp.side_id
    where bc.bet_id = v_bet.id and bc.version_no = v_version_no and bs.outcome_key <> v_outcome_key;

    if v_winner_payout > v_loser_pool then
      raise exception 'the payout if "%" wins exceeds what everyone else has staked', v_outcome_key;
    end if;
  end loop;

  -- Proposing implicitly approves your own proposal -- you clearly agree to
  -- terms you just wrote. Skipped for drafts, which aren't awaiting approval.
  if not p_is_draft then
    insert into public.bet_approvals (bet_id, version_no, user_id, decision)
    values (v_bet.id, v_version_no, auth.uid(), 'approved');

    if not v_applying_amendment then
      for v_other_user_id in
        select user_id from public.bet_participants
        where bet_id = v_bet.id and user_id <> auth.uid() and participation_status = 'active'
      loop
        perform public.notify_push(
          v_other_user_id,
          'New bet',
          v_bet.title || ' needs your response',
          jsonb_build_object('betId', v_bet.id)
        );
      end loop;
    end if;
  end if;

  return v_bet;
end;
$$;

-- ---------------------------------------------------------------------------
-- propose_bet_amendment: same signature as before (the root app still calls
-- it), new behaviour -- records a pending change instead of rewriting the bet.
-- resolution_method / judge / random fallback are not changeable this way;
-- the bet keeps its own.
-- ---------------------------------------------------------------------------
create or replace function public.propose_bet_amendment (
  p_bet_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz,
  p_resolution_method public.bet_resolution_method,
  p_judge_id uuid,
  p_random_fallback_enabled boolean,
  p_sides jsonb,
  p_participants jsonb
) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_name text;
  v_other_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('propose_bet_amendment', 10, interval '1 hour');

  select * into v_bet from public.bets where id = p_bet_id;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status <> 'active' then
    raise exception 'only an active bet can be changed -- use create_or_counter_bet while still negotiating';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid() and participation_status = 'active'
  ) then
    raise exception 'only a participant can propose a change to this bet';
  end if;
  if (
    select count(*) from public.bet_participants
    where bet_id = p_bet_id and participation_status = 'active'
  ) <> 2 then
    raise exception 'changes can only be proposed on a two-person bet';
  end if;
  if exists (
    select 1 from public.bet_amendments where bet_id = p_bet_id and status = 'pending'
  ) then
    raise exception 'there is already a change waiting for an answer on this bet';
  end if;
  -- Same people, no additions or removals.
  if (
    select array_agg(x order by x) from (
      select (elem ->> 'user_id')::uuid as x from jsonb_array_elements(p_participants) elem
    ) s
  ) is distinct from (
    select array_agg(user_id order by user_id) from public.bet_participants
    where bet_id = p_bet_id and participation_status = 'active'
  ) then
    raise exception 'a change can''t add or remove people from the bet';
  end if;

  -- Dry run: apply the change exactly as acceptance would, then roll it back.
  -- Every rule create_or_counter_bet enforces (moderation, blocked pairs,
  -- currency access, funding check) is checked now, when the proposer can
  -- fix it, instead of failing later on the other person's Accept tap.
  begin
    perform set_config('noshot.amendment_apply', 'on', true);
    perform public.create_or_counter_bet(
      p_bet_id, v_bet.group_id, p_title, p_description, p_deadline,
      v_bet.resolution_method, v_bet.judge_id, v_bet.random_fallback_enabled,
      p_sides, p_participants, false
    );
    raise exception using errcode = 'NSDRY', message = 'dry run';
  exception
    when sqlstate 'NSDRY' then null;
  end;

  insert into public.bet_amendments (
    bet_id, proposed_by, base_version, title, description, deadline, sides, participants
  )
  values (
    p_bet_id, auth.uid(), v_bet.current_version, trim(p_title), coalesce(p_description, ''),
    p_deadline, p_sides, p_participants
  );

  select display_name into v_name from public.profiles where id = auth.uid();
  for v_other_user_id in
    select user_id from public.bet_participants
    where bet_id = p_bet_id and user_id <> auth.uid() and participation_status = 'active'
  loop
    perform public.notify_push(
      v_other_user_id,
      'Change requested',
      coalesce(v_name, 'Someone') || ' wants to change "' || v_bet.title || '"',
      jsonb_build_object('betId', p_bet_id)
    );
  end loop;

  return v_bet;
end;
$$;

create function public.respond_to_bet_amendment (
  p_amendment_id uuid,
  p_decision public.bet_approval_decision
) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_amendment public.bet_amendments;
  v_bet public.bets;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('respond_to_bet_amendment', 30, interval '1 hour');

  select * into v_amendment from public.bet_amendments where id = p_amendment_id for update;
  if v_amendment.id is null then
    raise exception 'change request not found';
  end if;
  if v_amendment.status <> 'pending' then
    raise exception 'this change was already answered or withdrawn';
  end if;

  select * into v_bet from public.bets where id = v_amendment.bet_id for update;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = v_bet.id and user_id = auth.uid() and participation_status = 'active'
  ) then
    raise exception 'only a participant can respond to this change';
  end if;
  if auth.uid() = v_amendment.proposed_by then
    raise exception 'you can''t answer your own change request';
  end if;
  if v_bet.status <> 'active' or v_bet.current_version <> v_amendment.base_version then
    raise exception 'this bet has moved on since the change was proposed';
  end if;

  if p_decision = 'declined' then
    update public.bet_amendments
    set status = 'declined', responded_at = now()
    where id = p_amendment_id;

    perform public.notify_push(
      v_amendment.proposed_by,
      'Change declined',
      'Your change to "' || v_bet.title || '" was declined -- the bet stays as it was',
      jsonb_build_object('betId', v_bet.id)
    );
    return v_bet;
  end if;

  -- Accept: write the new version through the normal path (which approves it
  -- for the acceptor), approve it for the proposer, and put the bet straight
  -- back to active -- both people have now agreed to these exact terms.
  perform set_config('noshot.amendment_apply', 'on', true);
  v_bet := public.create_or_counter_bet(
    v_bet.id, v_bet.group_id, v_amendment.title, v_amendment.description,
    v_amendment.deadline, v_bet.resolution_method, v_bet.judge_id,
    v_bet.random_fallback_enabled, v_amendment.sides, v_amendment.participants, false
  );
  perform set_config('noshot.amendment_apply', 'off', true);

  insert into public.bet_approvals (bet_id, version_no, user_id, decision)
  values (v_bet.id, v_bet.current_version, v_amendment.proposed_by, 'approved');

  update public.bet_versions set status = 'approved'
  where bet_id = v_bet.id and version_no = v_bet.current_version;

  update public.bets set status = 'active' where id = v_bet.id returning * into v_bet;

  update public.bet_amendments
  set status = 'accepted', responded_at = now()
  where id = p_amendment_id;

  perform public.notify_push(
    v_amendment.proposed_by,
    'Change accepted',
    'Your change to "' || v_bet.title || '" was accepted',
    jsonb_build_object('betId', v_bet.id)
  );

  return v_bet;
end;
$$;

create function public.withdraw_bet_amendment (p_amendment_id uuid) returns public.bet_amendments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_amendment public.bet_amendments;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.bet_amendments
  set status = 'withdrawn', responded_at = now()
  where id = p_amendment_id and proposed_by = auth.uid() and status = 'pending'
  returning * into v_amendment;

  if v_amendment.id is null then
    raise exception 'no pending change of yours to withdraw';
  end if;
  return v_amendment;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_bet_result: report-then-confirm for participant_submission bets.
-- judge / group_vote branch identical to 20260726090000.
-- ---------------------------------------------------------------------------
create or replace function public.submit_bet_result (
  p_bet_id uuid,
  p_outcome_key text,
  p_rationale text default null
) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_submission_id uuid;
  v_distinct_outcomes integer;
  v_other_user_id uuid;
  v_name text;
  v_my_outcome text;
  v_admits_loss boolean;
  v_pending_submission public.bet_result_submissions;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('submit_bet_result', 20, interval '1 hour');

  select * into v_bet from public.bets where id = p_bet_id for update;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status not in ('active', 'pending_result', 'disputed') then
    raise exception 'this bet is not open for a result submission';
  end if;
  if p_outcome_key <> 'tie' and not exists (
    select 1 from public.bet_sides
    where bet_id = p_bet_id and version_no = v_bet.current_version and outcome_key = p_outcome_key
  ) then
    raise exception 'unknown outcome for this bet';
  end if;

  if v_bet.resolution_method = 'participant_submission' then
    if not exists (
      select 1 from public.bet_participants
      where bet_id = p_bet_id and user_id = auth.uid() and participation_status = 'active'
    ) then
      raise exception 'only a participant can submit a result for this bet';
    end if;
    if v_bet.status = 'pending_result' and v_bet.result_reported_by = auth.uid() then
      raise exception 'you already reported a result -- waiting for the other side to confirm or dispute it';
    end if;

    select bs.outcome_key into v_my_outcome
    from public.bet_participants bp
    join public.bet_sides bs on bs.id = bp.side_id
    where bp.bet_id = p_bet_id and bp.user_id = auth.uid();

    v_admits_loss := p_outcome_key <> 'tie' and p_outcome_key is distinct from v_my_outcome;

    if not v_admits_loss and exists (
      select 1
      from public.bet_result_submissions s
      join public.bet_result_confirmations c
        on c.result_submission_id = s.id and c.decision = 'declined'
      where s.bet_id = p_bet_id and s.submitter_id = auth.uid() and s.proposed_outcome_key = p_outcome_key
    ) then
      raise exception 'that result was already disputed -- report a different one or call the bet off';
    end if;

    -- Answering a pending report with your own report disputes it.
    if v_bet.status = 'pending_result' then
      select * into v_pending_submission from public.bet_result_submissions
      where id = v_bet.result_submission_id;
      if v_pending_submission.id is not null and not exists (
        select 1 from public.bet_result_confirmations
        where result_submission_id = v_pending_submission.id and user_id = auth.uid()
      ) then
        insert into public.bet_result_confirmations (bet_id, result_submission_id, user_id, decision)
        values (p_bet_id, v_pending_submission.id, auth.uid(), 'declined');
      end if;
    end if;

    insert into public.bet_result_submissions (bet_id, submitter_id, proposed_outcome_key, rationale)
    values (p_bet_id, auth.uid(), p_outcome_key, p_rationale)
    returning id into v_submission_id;

    insert into public.bet_result_confirmations (bet_id, result_submission_id, user_id, decision)
    values (p_bet_id, v_submission_id, auth.uid(), 'approved');

    select display_name into v_name from public.profiles where id = auth.uid();

    if v_admits_loss then
      update public.bets
      set result_reported_by = auth.uid(), result_due_at = null, result_submission_id = v_submission_id
      where id = p_bet_id;

      for v_other_user_id in
        select user_id from public.bet_participants
        where bet_id = p_bet_id and user_id <> auth.uid() and participation_status = 'active'
      loop
        perform public.notify_push(
          v_other_user_id,
          'You won',
          coalesce(v_name, 'Someone') || ' says you won "' || v_bet.title || '"',
          jsonb_build_object('betId', p_bet_id)
        );
      end loop;

      return public._finalize_bet_resolution(p_bet_id, p_outcome_key);
    end if;

    update public.bets
    set status = 'pending_result',
        result_reported_by = auth.uid(),
        result_submission_id = v_submission_id,
        result_due_at = now() + public.bet_result_confirm_window()
    where id = p_bet_id
    returning * into v_bet;

    for v_other_user_id in
      select user_id from public.bet_participants
      where bet_id = p_bet_id and user_id <> auth.uid() and participation_status = 'active'
    loop
      perform public.notify_push(
        v_other_user_id,
        'Who won?',
        coalesce(v_name, 'Someone')
          || (case when p_outcome_key = 'tie' then ' says "' || v_bet.title || '" was a tie'
                   else ' says they won "' || v_bet.title || '"' end)
          || ' -- confirm or dispute',
        jsonb_build_object('betId', p_bet_id)
      );
    end loop;

    return v_bet;
  end if;

  if v_bet.resolution_method = 'judge' then
    if auth.uid() <> v_bet.judge_id then
      raise exception 'only the designated judge can submit a result for this bet';
    end if;
  elsif v_bet.resolution_method = 'group_vote' then
    if v_bet.group_id is null or not exists (
      select 1 from public.group_members
      where group_id = v_bet.group_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'only an active group member can submit a result for this bet';
    end if;
  end if;

  insert into public.bet_result_submissions (bet_id, submitter_id, proposed_outcome_key, rationale)
  values (p_bet_id, auth.uid(), p_outcome_key, p_rationale)
  returning id into v_submission_id;

  insert into public.bet_result_confirmations (bet_id, result_submission_id, user_id, decision)
  values (p_bet_id, v_submission_id, auth.uid(), 'approved');

  select count(distinct proposed_outcome_key) into v_distinct_outcomes
  from public.bet_result_submissions
  where bet_id = p_bet_id;

  update public.bets
  set status = (case when v_distinct_outcomes > 1 then 'disputed' else 'pending_result' end)::public.bet_status
  where id = p_bet_id
  returning * into v_bet;

  return v_bet;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_bet_result: participant_submission bets respond to the LATEST
-- report only, and a dispute moves the bet to 'disputed'. Other methods
-- unchanged from 20260723140000.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_bet_result (
  p_bet_id uuid,
  p_result_submission_id uuid,
  p_decision public.bet_approval_decision
) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_submission public.bet_result_submissions;
  v_total_participants integer;
  v_total_confirmations integer;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('confirm_bet_result', 30, interval '1 hour');

  select * into v_bet from public.bets where id = p_bet_id for update;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status not in ('pending_result', 'disputed') then
    raise exception 'this bet has no result awaiting confirmation';
  end if;

  select * into v_submission from public.bet_result_submissions
  where id = p_result_submission_id and bet_id = p_bet_id;
  if v_submission.id is null then
    raise exception 'result submission not found';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid() and participation_status = 'active'
  ) then
    raise exception 'only a participant can confirm a result';
  end if;

  if v_bet.resolution_method = 'participant_submission' then
    if v_bet.status <> 'pending_result' then
      raise exception 'there is no reported result waiting for an answer';
    end if;
    if v_bet.result_submission_id is distinct from p_result_submission_id then
      raise exception 'that report has been replaced by a newer one';
    end if;
  end if;

  if exists (
    select 1 from public.bet_result_confirmations
    where result_submission_id = p_result_submission_id and user_id = auth.uid()
  ) then
    raise exception 'you have already responded to this submission';
  end if;

  insert into public.bet_result_confirmations (bet_id, result_submission_id, user_id, decision)
  values (p_bet_id, p_result_submission_id, auth.uid(), p_decision);

  if p_decision <> 'approved' then
    if v_bet.resolution_method = 'participant_submission' then
      update public.bets
      set status = 'disputed', result_due_at = null
      where id = p_bet_id
      returning * into v_bet;
    end if;
    select display_name into v_name from public.profiles where id = auth.uid();
    perform public.notify_push(
      v_submission.submitter_id,
      'Result disputed',
      coalesce(v_name, 'Someone') || ' disputed the result of "' || v_bet.title || '"',
      jsonb_build_object('betId', v_bet.id)
    );
    return v_bet;
  end if;

  select count(*) into v_total_participants
  from public.bet_participants
  where bet_id = p_bet_id and participation_status = 'active';

  select count(*) into v_total_confirmations
  from public.bet_result_confirmations
  where result_submission_id = p_result_submission_id and decision = 'approved';

  if v_total_confirmations >= v_total_participants then
    update public.bets set result_due_at = null where id = p_bet_id;
    return public._finalize_bet_resolution(p_bet_id, v_submission.proposed_outcome_key);
  end if;

  return v_bet;
end;
$$;

-- ---------------------------------------------------------------------------
-- call_off_bet: the way out of a dispute. Either side, unilaterally, because
-- a disputed 1v1 bet has no one else to decide it -- and calling it off
-- leaves nobody owing anything, so it can't be used to win.
-- ---------------------------------------------------------------------------
create function public.call_off_bet (p_bet_id uuid) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_name text;
  v_other_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('call_off_bet', 10, interval '1 hour');

  select * into v_bet from public.bets where id = p_bet_id for update;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid() and participation_status = 'active'
  ) then
    raise exception 'only a participant can call off this bet';
  end if;
  if v_bet.resolution_method <> 'participant_submission' or v_bet.status <> 'disputed' then
    raise exception 'only a disputed bet can be called off -- propose cancelling it instead';
  end if;

  update public.bets
  set status = 'voided', void_reason = 'called_off', result_due_at = null
  where id = p_bet_id
  returning * into v_bet;

  select display_name into v_name from public.profiles where id = auth.uid();
  for v_other_user_id in
    select user_id from public.bet_participants
    where bet_id = p_bet_id and user_id <> auth.uid() and participation_status = 'active'
  loop
    perform public.notify_push(
      v_other_user_id,
      'Bet called off',
      coalesce(v_name, 'Someone') || ' called off "' || v_bet.title || '" -- nobody owes anything',
      jsonb_build_object('betId', p_bet_id)
    );
  end loop;

  return v_bet;
end;
$$;

-- ---------------------------------------------------------------------------
-- Timers: overdue reports lock in, unanswered proposals expire.
-- p_user_id null = every bet (cron); otherwise only that user's bets.
-- ---------------------------------------------------------------------------
create function public._finalize_due_bets (p_user_id uuid) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row record;
  v_outcome text;
  v_count integer := 0;
  v_participant uuid;
begin
  for v_row in
    select b.id, b.title, b.result_submission_id from public.bets b
    where b.status = 'pending_result'
      and b.resolution_method = 'participant_submission'
      and b.result_due_at <= now()
      and (p_user_id is null or exists (
        select 1 from public.bet_participants bp
        where bp.bet_id = b.id and bp.user_id = p_user_id and bp.participation_status = 'active'
      ))
    for update skip locked
  loop
    select proposed_outcome_key into v_outcome from public.bet_result_submissions
    where id = v_row.result_submission_id;

    update public.bets set result_due_at = null where id = v_row.id;
    perform public._finalize_bet_resolution(v_row.id, v_outcome);
    v_count := v_count + 1;

    for v_participant in
      select user_id from public.bet_participants
      where bet_id = v_row.id and participation_status = 'active'
    loop
      perform public.notify_push(
        v_participant,
        'Result locked in',
        'Nobody disputed the result of "' || v_row.title || '", so it''s final',
        jsonb_build_object('betId', v_row.id)
      );
    end loop;
  end loop;

  for v_row in
    select b.id from public.bets b
    where b.status = 'pending_acceptance'
      and (
        select max(v.created_at) from public.bet_versions v where v.bet_id = b.id
      ) + public.bet_proposal_expiry() <= now()
      and (p_user_id is null or exists (
        select 1 from public.bet_participants bp
        where bp.bet_id = b.id and bp.user_id = p_user_id and bp.participation_status = 'active'
      ))
    for update skip locked
  loop
    update public.bets set status = 'voided', void_reason = 'expired' where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create function public.finalize_due_bets () returns integer language plpgsql security definer
set
  search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  return public._finalize_due_bets(auth.uid());
end;
$$;

-- Server-side schedule too, where pg_cron exists (it isn't in the local test
-- harness, and may not be enabled on every project -- the client-triggered
-- path above works either way).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'noshot-finalize-due-bets',
      '*/15 * * * *',
      'select public._finalize_due_bets(null)'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.bet_result_confirm_window ()
from
  public;

revoke all on function public.bet_proposal_expiry ()
from
  public;

revoke all on function public._set_bet_void_reason ()
from
  public;

revoke all on function public._finalize_due_bets (uuid)
from
  public;

revoke all on function public.respond_to_bet_amendment (uuid, public.bet_approval_decision)
from
  public;

revoke all on function public.withdraw_bet_amendment (uuid)
from
  public;

revoke all on function public.call_off_bet (uuid)
from
  public;

revoke all on function public.finalize_due_bets ()
from
  public;

grant
execute on function public.respond_to_bet_amendment (uuid, public.bet_approval_decision) to authenticated;

grant
execute on function public.withdraw_bet_amendment (uuid) to authenticated;

grant
execute on function public.call_off_bet (uuid) to authenticated;

grant
execute on function public.finalize_due_bets () to authenticated;
