-- Bet result submission and dispute resolution (Milestone 8 / RES-01..07,
-- §5.4, §9.3, §9.4). bet_result_submissions, bet_result_confirmations, and
-- dispute_resolutions are RPC-only per ARCHITECTURE.md §6, which already
-- named them there from the start. bet_dispute_votes is an addition beyond
-- the PRD's own table list (needed to implement group-vote fairly), given
-- the same RPC-only treatment for the same money/state-machine reason
-- bet_cancellation_approvals got it in Milestone 7.
--
-- Scope note: this migration determines and records the final outcome of a
-- bet (bets.status -> 'resolved'/'tied', bets.resolved_outcome_key set) but
-- does NOT write ledger entries -- `ledger_entries` doesn't exist until
-- Milestone 9. RES-07 ("create all ledger entries atomically") is
-- deliberately deferred the same way Milestone 10's manual obligations
-- deferred their ledger write: resolved_outcome_key is exactly what
-- Milestone 9 needs to compute and post the real obligations once its
-- ledger table exists, without re-deriving anything from here.
--
-- "Tie" is treated as a reserved outcome key ('tie') always valid for
-- submission/resolution, rather than requiring the creator to have added
-- an explicit tie side at bet-creation time -- PRD §5.2 describes win/loss/
-- tie as the *default* outcome set, and Milestone 6's creation UI doesn't
-- yet expose adding a third side, so tie needs to work independently of
-- whatever sides happen to exist.
alter table public.bets
add column resolved_outcome_key text;

create table public.bet_result_submissions (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  submitter_id uuid not null references public.profiles (id) on delete cascade,
  proposed_outcome_key text not null,
  rationale text,
  created_at timestamptz not null default now()
);

create index bet_result_submissions_bet_idx on public.bet_result_submissions (bet_id);

create table public.bet_result_confirmations (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  result_submission_id uuid not null references public.bet_result_submissions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  decision public.bet_approval_decision not null,
  created_at timestamptz not null default now(),
  unique (result_submission_id, user_id)
);

create table public.bet_dispute_votes (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  outcome_key text not null,
  created_at timestamptz not null default now(),
  unique (bet_id, voter_id)
);

create table public.dispute_resolutions (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  eligible_outcomes_json jsonb,
  resolution_method public.bet_resolution_method not null,
  judge_or_vote_snapshot_json jsonb,
  selected_outcome_key text not null,
  created_at timestamptz not null default now()
);

alter table public.bet_result_submissions enable row level security;

alter table public.bet_result_confirmations enable row level security;

alter table public.bet_dispute_votes enable row level security;

alter table public.dispute_resolutions enable row level security;

revoke all on public.bet_result_submissions
from
  anon;

revoke all on public.bet_result_confirmations
from
  anon;

revoke all on public.bet_dispute_votes
from
  anon;

revoke all on public.dispute_resolutions
from
  anon;

grant
select
  on public.bet_result_submissions to authenticated;

grant
select
  on public.bet_result_confirmations to authenticated;

grant
select
  on public.bet_dispute_votes to authenticated;

grant
select
  on public.dispute_resolutions to authenticated;

create policy bet_result_submissions_select on public.bet_result_submissions for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy bet_result_confirmations_select on public.bet_result_confirmations for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy bet_dispute_votes_select on public.bet_dispute_votes for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy dispute_resolutions_select on public.dispute_resolutions for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

-- Internal only -- no grant to authenticated/anon below, only ever called
-- from the SECURITY DEFINER functions in this file.
create function public._finalize_bet_resolution (p_bet_id uuid, p_outcome_key text) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
begin
  update public.bets
  set status = (case when p_outcome_key = 'tie' then 'tied' else 'resolved' end)::public.bet_status,
      resolved_at = now(),
      resolved_outcome_key = p_outcome_key
  where id = p_bet_id
  returning * into v_bet;

  return v_bet;
end;
$$;

create function public.submit_bet_result (
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

create function public.confirm_bet_result (
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

create function public.resolve_dispute (p_bet_id uuid, p_outcome_key text) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_eligible_outcomes jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_bet from public.bets where id = p_bet_id;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status <> 'disputed' then
    raise exception 'this bet is not disputed';
  end if;
  if v_bet.resolution_method <> 'judge' then
    raise exception 'this bet does not have a judge configured';
  end if;
  if auth.uid() <> v_bet.judge_id then
    raise exception 'only the designated judge can resolve this dispute';
  end if;
  if p_outcome_key <> 'tie' and not exists (
    select 1 from public.bet_sides
    where bet_id = p_bet_id and version_no = v_bet.current_version and outcome_key = p_outcome_key
  ) then
    raise exception 'unknown outcome for this bet';
  end if;

  select jsonb_agg(distinct proposed_outcome_key) into v_eligible_outcomes
  from public.bet_result_submissions
  where bet_id = p_bet_id;

  insert into public.dispute_resolutions (
    bet_id, eligible_outcomes_json, resolution_method, judge_or_vote_snapshot_json, selected_outcome_key
  )
  values (
    p_bet_id, v_eligible_outcomes, 'judge',
    jsonb_build_object('judge_id', v_bet.judge_id), p_outcome_key
  );

  return public._finalize_bet_resolution(p_bet_id, p_outcome_key);
end;
$$;

create function public.vote_on_dispute (p_bet_id uuid, p_outcome_key text) returns public.bets language plpgsql security definer
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

create function public.trigger_random_fallback (p_bet_id uuid) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_eligible_outcomes jsonb;
  v_selected text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_bet from public.bets where id = p_bet_id;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status <> 'disputed' then
    raise exception 'this bet is not disputed';
  end if;
  if not v_bet.random_fallback_enabled then
    raise exception 'random fallback is not enabled for this bet';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid() and participation_status = 'active'
  ) then
    raise exception 'only a participant can trigger the random fallback';
  end if;

  select jsonb_agg(distinct proposed_outcome_key) into v_eligible_outcomes
  from public.bet_result_submissions
  where bet_id = p_bet_id;

  -- Random fallback selects only among submitted outcomes (Appendix B) --
  -- unlike a judge or group vote, it brings no judgment of its own beyond
  -- what was actually claimed.
  select proposed_outcome_key into v_selected
  from public.bet_result_submissions
  where bet_id = p_bet_id
  group by proposed_outcome_key
  order by random()
  limit 1;

  insert into public.dispute_resolutions (
    bet_id, eligible_outcomes_json, resolution_method, judge_or_vote_snapshot_json, selected_outcome_key
  )
  values (
    p_bet_id, v_eligible_outcomes, v_bet.resolution_method,
    jsonb_build_object('random_fallback', true, 'triggered_by', auth.uid()), v_selected
  );

  return public._finalize_bet_resolution(p_bet_id, v_selected);
end;
$$;

revoke execute on function public._finalize_bet_resolution (uuid, text)
from
  public;

revoke execute on function public.submit_bet_result (uuid, text, text)
from
  public;

revoke execute on function public.confirm_bet_result (uuid, uuid, public.bet_approval_decision)
from
  public;

revoke execute on function public.resolve_dispute (uuid, text)
from
  public;

revoke execute on function public.vote_on_dispute (uuid, text)
from
  public;

revoke execute on function public.trigger_random_fallback (uuid)
from
  public;

grant
execute on function public.submit_bet_result (uuid, text, text) to authenticated;

grant
execute on function public.confirm_bet_result (uuid, uuid, public.bet_approval_decision) to authenticated;

grant
execute on function public.resolve_dispute (uuid, text) to authenticated;

grant
execute on function public.vote_on_dispute (uuid, text) to authenticated;

grant
execute on function public.trigger_random_fallback (uuid) to authenticated;
