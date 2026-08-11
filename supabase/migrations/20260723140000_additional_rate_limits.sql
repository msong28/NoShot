-- Follow-up to 20260723120000_mutation_rate_limits.sql: that migration
-- covered the five RPCs found in the original security review pass, but a
-- fuller audit turns up more authenticated write paths with no bound on
-- call frequency at all -- resource-creation endpoints (create_group,
-- create_poll, propose_manual_obligation), a storage-backed upload
-- (upload_proof), a harassment vector (submit_report, since nothing stops
-- one user from mass-reporting another), state-churning toggles
-- (block_user, vote_on_poll, vote_on_dispute), and a couple of
-- confirmation-side functions that got missed when notify_push() calls
-- were wired into their sibling RPCs (confirm_bet_result,
-- request_redemption -- both already had enforce_rate_limit on their
-- *counterpart* creation function, submit_bet_result/create_or_counter_bet,
-- but not on themselves).
--
-- Deliberately left alone: purely responsive actions gated by a row that
-- can only be in a "pending"-like status once (respond_friend_request,
-- respond_to_group_invite, approve_bet_version, approve_manual_obligation,
-- decline_manual_obligation, cancel_manual_obligation, approve_cancel_bet,
-- confirm_redemption, decline_redemption, cancel_redemption, close_poll,
-- resolve_dispute, trigger_random_fallback) -- an attacker can't replay
-- those against the same row, and spamming them against many rows is
-- already bounded by the creation-side limits added here and previously.
create or replace function public.create_group (p_name text) returns public.groups language plpgsql security definer
set
  search_path = '' as $$
declare
  v_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('create_group', 10, interval '1 hour');
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 50 then
    raise exception 'group name must be between 1 and 50 characters';
  end if;
  if public.moderate_text(p_name) = 'block' then
    raise exception 'that name isn''t allowed';
  end if;

  insert into public.groups (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_group.id, auth.uid(), 'owner', 'active', now());

  return v_group;
end;
$$;

create or replace function public.block_user (p_blocked_id uuid) returns public.blocks language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.blocks;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('block_user', 30, interval '1 hour');
  if p_blocked_id = auth.uid() then
    raise exception 'cannot block yourself';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.blocks
    where blocker_id = auth.uid() and blocked_id = p_blocked_id;
  end if;

  -- Blocking overrides any active friendship between the two users (FR-05).
  update public.friendships
  set status = 'cancelled',
      responded_at = now()
  where status in ('pending', 'accepted')
    and (
      (requester_id = auth.uid() and addressee_id = p_blocked_id)
      or (requester_id = p_blocked_id and addressee_id = auth.uid())
    );

  return v_row;
end;
$$;

create or replace function public.propose_cancel_bet (p_bet_id uuid, p_reason text default null) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('propose_cancel_bet', 10, interval '1 hour');

  select * into v_bet from public.bets where id = p_bet_id;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status <> 'active' then
    raise exception 'only an active bet can be proposed for cancellation';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid() and participation_status = 'active'
  ) then
    raise exception 'only a participant can propose cancelling this bet';
  end if;

  -- Defensive cleanup: an earlier attempt should already have cleared its
  -- own rows on decline, but starting fresh here guards against any prior
  -- inconsistency rather than silently reusing stale approvals.
  delete from public.bet_cancellation_approvals where bet_id = p_bet_id;

  update public.bets set status = 'cancellation_pending' where id = p_bet_id returning * into v_bet;

  insert into public.bet_cancellation_approvals (bet_id, user_id, decision, reason)
  values (p_bet_id, auth.uid(), 'approved', p_reason);

  return v_bet;
end;
$$;

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
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('submit_bet_result', 20, interval '1 hour');

  select * into v_bet from public.bets where id = p_bet_id;
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
  elsif v_bet.resolution_method = 'judge' then
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

  -- Proposing implicitly confirms your own submission, same convention as
  -- the negotiation and cancellation flows.
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

create or replace function public.vote_on_dispute (p_bet_id uuid, p_outcome_key text) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_total_voters integer;
  v_total_votes integer;
  v_winning_outcome text;
  v_eligible_outcomes jsonb;
  v_votes_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('vote_on_dispute', 30, interval '1 hour');

  select * into v_bet from public.bets where id = p_bet_id;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status <> 'disputed' then
    raise exception 'this bet is not disputed';
  end if;
  if v_bet.resolution_method <> 'group_vote' or v_bet.group_id is null then
    raise exception 'this bet does not have group voting configured';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = v_bet.group_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'only an active group member can vote';
  end if;
  if p_outcome_key <> 'tie' and not exists (
    select 1 from public.bet_sides
    where bet_id = p_bet_id and version_no = v_bet.current_version and outcome_key = p_outcome_key
  ) then
    raise exception 'unknown outcome for this bet';
  end if;

  insert into public.bet_dispute_votes (bet_id, voter_id, outcome_key)
  values (p_bet_id, auth.uid(), p_outcome_key)
  on conflict (bet_id, voter_id) do update
  set outcome_key = excluded.outcome_key,
      created_at = now();

  select count(*) into v_total_voters
  from public.group_members
  where group_id = v_bet.group_id and status = 'active';

  select count(*) into v_total_votes
  from public.bet_dispute_votes
  where bet_id = p_bet_id;

  if v_total_votes < v_total_voters then
    return v_bet;
  end if;

  select outcome_key into v_winning_outcome
  from public.bet_dispute_votes
  where bet_id = p_bet_id
  group by outcome_key
  order by count(*) desc, outcome_key
  limit 1;

  select jsonb_agg(distinct proposed_outcome_key) into v_eligible_outcomes
  from public.bet_result_submissions
  where bet_id = p_bet_id;

  select jsonb_object_agg(voter_id::text, outcome_key) into v_votes_snapshot
  from public.bet_dispute_votes
  where bet_id = p_bet_id;

  insert into public.dispute_resolutions (
    bet_id, eligible_outcomes_json, resolution_method, judge_or_vote_snapshot_json, selected_outcome_key
  )
  values (p_bet_id, v_eligible_outcomes, 'group_vote', v_votes_snapshot, v_winning_outcome);

  return public._finalize_bet_resolution(p_bet_id, v_winning_outcome);
end;
$$;

create or replace function public.propose_manual_obligation (
  p_debtor_id uuid,
  p_creditor_id uuid,
  p_currency_id uuid,
  p_amount numeric,
  p_description text
) returns public.manual_obligation_proposals language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.manual_obligation_proposals;
  v_counterparty_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('propose_manual_obligation', 20, interval '1 hour');
  if p_debtor_id = p_creditor_id then
    raise exception 'a manual obligation needs two different people';
  end if;
  if auth.uid() <> p_debtor_id and auth.uid() <> p_creditor_id then
    raise exception 'you must be one of the two people in this obligation';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than zero';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 1 or char_length(trim(p_description)) > 200 then
    raise exception 'description must be between 1 and 200 characters';
  end if;

  v_counterparty_id := case when auth.uid() = p_debtor_id then p_creditor_id else p_debtor_id end;

  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = auth.uid() and addressee_id = v_counterparty_id)
        or (requester_id = v_counterparty_id and addressee_id = auth.uid())
      )
  ) then
    raise exception 'you can only propose a manual obligation to a friend';
  end if;

  if public.is_blocked_pair(auth.uid(), v_counterparty_id) then
    raise exception 'cannot propose an obligation with this user';
  end if;

  -- Deliberately builtin-or-shared-group only, not a personal currency
  -- owned by either party: currencies' own RLS only lets the owner SELECT
  -- their personal currencies, so a currency owned by one party would be
  -- invisible (name/icon unrenderable) to the other. Builtins and
  -- shared-group currencies are visible to both by construction.
  if not exists (
    select 1 from public.currencies c
    where c.id = p_currency_id
      and (
        c.is_builtin
        or (
          c.group_id is not null
          and exists (
            select 1 from public.group_members gm
            where gm.group_id = c.group_id and gm.user_id = p_debtor_id and gm.status = 'active'
          )
          and exists (
            select 1 from public.group_members gm
            where gm.group_id = c.group_id and gm.user_id = p_creditor_id and gm.status = 'active'
          )
        )
      )
  ) then
    raise exception 'that currency isn''t available to both people';
  end if;

  insert into public.manual_obligation_proposals (
    proposer_id, debtor_id, creditor_id, currency_id, amount, description
  )
  values (auth.uid(), p_debtor_id, p_creditor_id, p_currency_id, p_amount, trim(p_description))
  returning * into v_row;

  return v_row;
end;
$$;

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
  perform public.enforce_rate_limit('request_redemption', 20, interval '1 hour');

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
  perform public.enforce_rate_limit('confirm_bet_result', 30, interval '1 hour');

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

create or replace function public.forgive_obligation (p_allocations jsonb, p_note text default null) returns public.forgiveness_events language plpgsql security definer
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
  v_row public.forgiveness_events;
  v_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('forgive_obligation', 20, interval '1 hour');

  if p_note is not null and char_length(trim(p_note)) > 200 then
    raise exception 'note must be 200 characters or fewer';
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
      raise exception 'that entry cannot be forgiven';
    end if;
    if v_source.creditor_id <> auth.uid() then
      raise exception 'only the creditor can forgive an obligation';
    end if;

    if v_count = 1 then
      v_debtor_id := v_source.debtor_id;
      v_creditor_id := v_source.creditor_id;
      v_currency_id := v_source.currency_id;
      v_group_id := v_source.group_id;
    elsif v_source.debtor_id <> v_debtor_id
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
      raise exception 'forgiven amount exceeds the outstanding balance on that obligation';
    end if;

    v_total := v_total + v_alloc.amount;
  end loop;

  if v_count = 0 then
    raise exception 'select at least one obligation to forgive';
  end if;

  insert into public.forgiveness_events (creditor_id, debtor_id, currency_id, group_id, amount, note)
  values (v_creditor_id, v_debtor_id, v_currency_id, v_group_id, v_total, nullif(trim(p_note), ''))
  returning * into v_row;

  insert into public.obligation_allocations (source_entry_id, forgiveness_event_id, amount)
  select (x ->> 'source_entry_id')::uuid, v_row.id, (x ->> 'amount')::numeric
  from jsonb_array_elements(p_allocations) as x;

  insert into public.ledger_entries (
    debtor_id, creditor_id, group_id, currency_id, amount, entry_type, source_type, source_id
  )
  values (
    v_row.creditor_id, v_row.debtor_id, v_row.group_id, v_row.currency_id, v_row.amount,
    'forgiveness', 'forgiveness', v_row.id
  );

  return v_row;
end;
$$;

create or replace function public.create_poll (
  p_bet_id uuid,
  p_group_id uuid,
  p_question text,
  p_options text[],
  p_allow_multiple boolean default false
) returns public.polls language plpgsql security definer
set
  search_path = '' as $$
declare
  v_poll public.polls;
  v_tier text;
  v_label text;
  v_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('create_poll', 20, interval '1 hour');
  if (p_bet_id is not null)::int + (p_group_id is not null)::int <> 1 then
    raise exception 'a poll needs exactly one of a bet or a group';
  end if;
  if char_length(trim(coalesce(p_question, ''))) < 1 or char_length(p_question) > 200 then
    raise exception 'question must be between 1 and 200 characters';
  end if;
  if p_options is null or array_length(p_options, 1) < 2 then
    raise exception 'a poll needs at least two options';
  end if;

  if p_bet_id is not null then
    if not exists (
      select 1 from public.bet_participants
      where bet_id = p_bet_id and user_id = auth.uid()
    ) then
      raise exception 'only a participant can create a poll on this bet';
    end if;
    if exists (
      select 1 from public.bet_participants bp
      where bp.bet_id = p_bet_id
        and bp.user_id <> auth.uid()
        and public.is_blocked_pair(auth.uid(), bp.user_id)
    ) then
      raise exception 'you cannot interact with this bet due to a block';
    end if;
  else
    if not exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'you must be an active member of this group';
    end if;
  end if;

  v_tier := public.moderate_text(p_question);
  if v_tier = 'block' then
    raise exception 'that question isn''t allowed';
  end if;

  insert into public.polls (bet_id, group_id, creator_id, question, allow_multiple)
  values (p_bet_id, p_group_id, auth.uid(), trim(p_question), coalesce(p_allow_multiple, false))
  returning * into v_poll;

  foreach v_label in array p_options
  loop
    if char_length(trim(coalesce(v_label, ''))) < 1 or char_length(v_label) > 100 then
      raise exception 'each option must be between 1 and 100 characters';
    end if;
    if public.moderate_text(v_label) = 'block' then
      raise exception 'that option isn''t allowed';
    end if;
    insert into public.poll_options (poll_id, label, position)
    values (v_poll.id, trim(v_label), v_position);
    v_position := v_position + 1;
  end loop;

  return v_poll;
end;
$$;

create or replace function public.vote_on_poll (p_poll_id uuid, p_option_id uuid) returns public.poll_votes language plpgsql security definer
set
  search_path = '' as $$
declare
  v_poll public.polls;
  v_row public.poll_votes;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('vote_on_poll', 60, interval '1 hour');

  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then
    raise exception 'poll not found';
  end if;
  if v_poll.closed_at is not null then
    raise exception 'this poll is closed';
  end if;
  if not exists (select 1 from public.poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'that option does not belong to this poll';
  end if;

  if v_poll.bet_id is not null then
    if not exists (
      select 1 from public.bet_participants
      where bet_id = v_poll.bet_id and user_id = auth.uid()
    ) then
      raise exception 'only a participant can vote on this poll';
    end if;
    if exists (
      select 1 from public.bet_participants bp
      where bp.bet_id = v_poll.bet_id
        and bp.user_id <> auth.uid()
        and public.is_blocked_pair(auth.uid(), bp.user_id)
    ) then
      raise exception 'you cannot interact with this bet due to a block';
    end if;
  else
    if not exists (
      select 1 from public.group_members
      where group_id = v_poll.group_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'you must be an active member of this group';
    end if;
  end if;

  if not v_poll.allow_multiple then
    delete from public.poll_votes where poll_id = p_poll_id and voter_id = auth.uid();
  end if;

  insert into public.poll_votes (poll_id, option_id, voter_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, option_id, voter_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.poll_votes
    where poll_id = p_poll_id and option_id = p_option_id and voter_id = auth.uid();
  end if;

  return v_row;
end;
$$;

create or replace function public.upload_proof (
  p_bet_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_caption text default null
) returns public.proof_assets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.proof_assets;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('upload_proof', 20, interval '1 hour');
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid()
  ) then
    raise exception 'only a participant can upload proof for this bet';
  end if;
  if exists (
    select 1 from public.bet_participants bp
    where bp.bet_id = p_bet_id
      and bp.user_id <> auth.uid()
      and public.is_blocked_pair(auth.uid(), bp.user_id)
  ) then
    raise exception 'you cannot interact with this bet due to a block';
  end if;
  if p_storage_path not like (p_bet_id::text || '/%') then
    raise exception 'storage path must be scoped to this bet';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'unsupported image type';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'image must be between 1 byte and 10MB';
  end if;

  if p_caption is not null then
    if char_length(p_caption) > 500 then
      raise exception 'caption must be 500 characters or fewer';
    end if;
    v_tier := public.moderate_text(p_caption);
    if v_tier = 'block' then
      raise exception 'that caption isn''t allowed';
    end if;
  end if;

  insert into public.proof_assets (
    bet_id, uploader_id, storage_path, mime_type, size_bytes, caption, moderation_status
  )
  values (
    p_bet_id, auth.uid(), p_storage_path, p_mime_type, p_size_bytes, nullif(trim(coalesce(p_caption, '')), ''),
    (case when v_tier = 'warn' then 'pending_review' else 'approved' end)::public.content_moderation_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.submit_report (
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason public.report_reason,
  p_details text default null
) returns public.reports language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.reports;
  v_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('submit_report', 20, interval '1 hour');
  if p_details is not null and char_length(p_details) > 1000 then
    raise exception 'details must be 1000 characters or fewer';
  end if;

  v_exists := case p_target_type
    when 'bet' then exists (select 1 from public.bets where id = p_target_id)
    when 'currency' then exists (select 1 from public.currencies where id = p_target_id)
    when 'comment' then exists (select 1 from public.comments where id = p_target_id)
    when 'chat_message' then exists (select 1 from public.chat_messages where id = p_target_id)
    when 'proof_asset' then exists (select 1 from public.proof_assets where id = p_target_id)
    when 'user' then exists (select 1 from public.profiles where id = p_target_id and deleted_at is null)
  end;

  if not v_exists then
    raise exception 'the thing you''re trying to report no longer exists';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(coalesce(p_details, '')), ''))
  returning * into v_row;

  return v_row;
end;
$$;
