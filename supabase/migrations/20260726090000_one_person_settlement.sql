-- One-person settlement for participant-submission bets.
--
-- Product change: for a plain 1v1 participant_submission bet (the only kind
-- the current create flow produces), whoever reports the outcome now settles
-- the bet outright -- it finalizes immediately, posts the ledger obligation,
-- and pushes a "Bet settled" notification to the other side. There is no
-- second confirmation step and no dispute for this method; it's a trust-based
-- model appropriate for a friends app, and it's an explicit product decision
-- that either party can unilaterally declare the result (see DECISIONS.md).
--
-- Scope: ONLY resolution_method = 'participant_submission' changes. 'judge'
-- and 'group_vote' bets keep their exact original two-step behavior (submit ->
-- pending_result/disputed -> confirm/resolve/vote), so this is a targeted
-- rewrite of submit_bet_result() rather than a change to the shared
-- _finalize_bet_resolution() chokepoint (which still does the real ledger
-- posting for every path).
--
-- Consequence, intended: a participant_submission bet can no longer reach
-- 'disputed' or 'pending_result', so confirm_bet_result / vote_on_dispute /
-- resolve_dispute / trigger_random_fallback are simply never reached for that
-- method. Those functions are left in place unchanged for the judge/group_vote
-- methods that still use them.
--
-- notify_push() is the same exception-safe choke point every other trigger
-- site uses -- a push failure never breaks the settlement, and it degrades to
-- a no-op in the local pgTAP harness.
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
  v_settler_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

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

  -- Reporting implicitly confirms your own submission, same convention as the
  -- negotiation and cancellation flows.
  insert into public.bet_result_confirmations (bet_id, result_submission_id, user_id, decision)
  values (p_bet_id, v_submission_id, auth.uid(), 'approved');

  -- One-person settlement: a straight participant-submitted bet is settled by
  -- whoever reports it. Finalize immediately and tell the other side.
  if v_bet.resolution_method = 'participant_submission' then
    select display_name into v_settler_name from public.profiles where id = auth.uid();

    for v_other_user_id in
      select user_id from public.bet_participants
      where bet_id = p_bet_id and user_id <> auth.uid() and participation_status = 'active'
    loop
      perform public.notify_push(
        v_other_user_id,
        'Bet settled',
        coalesce(v_settler_name, 'Someone') || ' settled "' || v_bet.title || '"',
        jsonb_build_object('betId', p_bet_id)
      );
    end loop;

    return public._finalize_bet_resolution(p_bet_id, p_outcome_key);
  end if;

  -- judge / group_vote: unchanged two-step behavior. A second, differing
  -- submission disputes; otherwise the bet waits on confirmation.
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
