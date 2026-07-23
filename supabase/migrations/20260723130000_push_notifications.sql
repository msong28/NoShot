-- Native push notifications (TestFlight readiness: real native
-- functionality beyond a repackaged website). Client side, OneSignal's
-- login(externalId) associates a device with our own Supabase user id, so
-- there's no push-token table of our own to maintain here -- sending a
-- push means calling the send-push Edge Function with a target user id,
-- which asks OneSignal to reach whichever devices are currently logged in
-- as that user via its own `external_id` alias.
--
-- notify_push() is the single choke point every trigger site below calls.
-- It is deliberately exception-safe: a push failure (OneSignal down,
-- missing secret, no network) must never break the bet/friend-request/
-- redemption mutation that triggered it, so the whole body is wrapped and
-- any error is swallowed. That also means this degrades to a silent no-op
-- in the local pgTAP harness, which has neither `vault` nor `pg_net` --
-- intentional, not an oversight.
-- Guarded rather than a bare `create extension if not exists pg_net`:
-- hosted Supabase always has pg_net available, but a plain local Postgres
-- (e.g. this repo's own scripts/test-db.sh harness) doesn't ship its
-- control file at all -- `create extension` on a genuinely unavailable
-- extension fails outright, unlike enabling one that's merely not yet
-- turned on.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net';
  end if;
end $$;

create function public.notify_push (
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_notifications_enabled boolean;
  v_secret text;
begin
  select coalesce(notifications_enabled, true) into v_notifications_enabled
  from public.profiles where id = p_user_id;

  if v_notifications_enabled is false then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'push_dispatch_secret';

  if v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://tckpbwvzxxovnsvdtwee.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := jsonb_build_object(
      'userId', p_user_id,
      'title', p_title,
      'body', p_body,
      'data', p_data
    )
  );
exception
  when others then
    null;
end;
$$;

-- Internal only -- never granted to authenticated/anon, only called from
-- within the other SECURITY DEFINER function bodies below (same shape as
-- enforce_rate_limit()/is_blocked_pair()).
revoke execute on function public.notify_push (uuid, text, text, jsonb)
from
  public;

-- 1. Bet needs approval -- notify every other participant when a
-- non-draft bet is proposed or counter-proposed.
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

  return v_bet;
end;
$$;

-- 2. A result submission is disputed -- notify the original submitter.
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
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_bet from public.bets where id = p_bet_id;
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
  if exists (
    select 1 from public.bet_result_confirmations
    where result_submission_id = p_result_submission_id and user_id = auth.uid()
  ) then
    raise exception 'you have already responded to this submission';
  end if;

  insert into public.bet_result_confirmations (bet_id, result_submission_id, user_id, decision)
  values (p_bet_id, p_result_submission_id, auth.uid(), p_decision);

  if p_decision <> 'approved' then
    perform public.notify_push(
      v_submission.submitter_id,
      'Result disputed',
      v_bet.title || ' -- your reported result was disputed',
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

  -- Everyone converging on the SAME submission finalizes it, whether the
  -- bet is currently pending_result or disputed -- this is exactly how a
  -- dispute with no configured fallback organically resolves per §5.4
  -- ("remains disputed until affected participants agree").
  if v_total_confirmations >= v_total_participants then
    return public._finalize_bet_resolution(p_bet_id, v_submission.proposed_outcome_key);
  end if;

  return v_bet;
end;
$$;

-- 3. Friend request received.
create or replace function public.send_friend_request (p_addressee_id uuid) returns public.friendships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.friendships;
  v_requester_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('friend_request', 20, interval '1 hour');
  if p_addressee_id = auth.uid() then
    raise exception 'cannot send a friend request to yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_addressee_id and deleted_at is null) then
    raise exception 'user not found';
  end if;
  if public.is_blocked_pair(auth.uid(), p_addressee_id) then
    raise exception 'cannot send a friend request to this user';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), p_addressee_id, 'pending')
  returning * into v_row;

  select display_name into v_requester_name from public.profiles where id = auth.uid();
  perform public.notify_push(
    p_addressee_id,
    'Friend request',
    coalesce(v_requester_name, 'Someone') || ' wants to be friends',
    jsonb_build_object('friendshipId', v_row.id)
  );

  return v_row;
exception
  when unique_violation then
    raise exception 'a pending or accepted friendship with this user already exists';
end;
$$;

-- 4. Redemption (settle-up) request needs the creditor's confirmation.
create or replace function public.request_redemption (p_allocations jsonb) returns public.redemption_requests language plpgsql security definer
set
  search_path = '' as $$
declare
  v_alloc record;
  v_source public.ledger_entries;
  v_allocated numeric;
  v_outstanding numeric;
  v_debtor_id uuid;
  v_creditor_id uuid;
  v_currency_id uuid;
  v_group_id uuid;
  v_total numeric := 0;
  v_row public.redemption_requests;
  v_count int := 0;
  v_debtor_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  for v_alloc in select * from jsonb_to_recordset(p_allocations) as x(source_entry_id uuid, amount numeric)
  loop
    v_count := v_count + 1;

    if v_alloc.amount is null or v_alloc.amount <= 0 then
      raise exception 'each allocation amount must be greater than zero';
    end if;

    select * into v_source from public.ledger_entries where id = v_alloc.source_entry_id for update;
    if v_source.id is null then
      raise exception 'obligation not found';
    end if;
    if v_source.entry_type not in ('bet_settlement', 'manual_obligation') then
      raise exception 'that entry cannot be redeemed';
    end if;
    if v_source.debtor_id <> auth.uid() then
      raise exception 'only the debtor can request redemption';
    end if;

    if v_count = 1 then
      v_debtor_id := v_source.debtor_id;
      v_creditor_id := v_source.creditor_id;
      v_currency_id := v_source.currency_id;
      v_group_id := v_source.group_id;
    elsif v_source.creditor_id <> v_creditor_id
      or v_source.currency_id <> v_currency_id
      or v_source.group_id is distinct from v_group_id then
      raise exception 'all selected obligations must share the same counterparty, currency, and group';
    end if;

    select coalesce(sum(oa.amount), 0) into v_allocated
    from public.obligation_allocations oa
    left join public.redemption_requests rr on rr.id = oa.redemption_request_id
    where oa.source_entry_id = v_source.id
      and (oa.forgiveness_event_id is not null or rr.status in ('pending', 'confirmed'));

    v_outstanding := v_source.amount - v_allocated;
    if v_alloc.amount > v_outstanding then
      raise exception 'requested amount exceeds the outstanding balance on that obligation';
    end if;

    v_total := v_total + v_alloc.amount;
  end loop;

  if v_count = 0 then
    raise exception 'select at least one obligation to redeem';
  end if;

  insert into public.redemption_requests (debtor_id, creditor_id, currency_id, group_id, amount)
  values (v_debtor_id, v_creditor_id, v_currency_id, v_group_id, v_total)
  returning * into v_row;

  insert into public.obligation_allocations (source_entry_id, redemption_request_id, amount)
  select (x ->> 'source_entry_id')::uuid, v_row.id, (x ->> 'amount')::numeric
  from jsonb_array_elements(p_allocations) as x;

  select display_name into v_debtor_name from public.profiles where id = v_debtor_id;
  perform public.notify_push(
    v_creditor_id,
    'Settle up',
    coalesce(v_debtor_name, 'Someone') || ' says they paid you back',
    jsonb_build_object('redemptionRequestId', v_row.id)
  );

  return v_row;
end;
$$;
