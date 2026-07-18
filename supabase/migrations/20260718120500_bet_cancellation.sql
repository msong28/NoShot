-- Bet cancellation (Milestone 7 / BET-09, §5.2 "Cancellation requires
-- approval from affected participants"). Only applies to an *active* bet --
-- killing a not-yet-activated proposal already goes through
-- approve_bet_version()'s decline path (see 20260718090000_bets_core.sql),
-- since nothing was agreed to yet and there's nothing to "undo".
--
-- Not versioned like bet_versions/bet_approvals: there's only ever one
-- current cancellation attempt at a time. A decline clears the attempt back
-- to square one (bet stays active, rows deleted) rather than leaving stale
-- history to track through a version number.
create table public.bet_cancellation_approvals (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  decision public.bet_approval_decision not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (bet_id, user_id)
);

alter table public.bet_cancellation_approvals enable row level security;

revoke all on public.bet_cancellation_approvals
from
  anon;

-- Same RPC-only rationale as the rest of the bet engine (ARCHITECTURE.md §6).
grant
select
  on public.bet_cancellation_approvals to authenticated;

create policy bet_cancellation_approvals_select on public.bet_cancellation_approvals for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create function public.propose_cancel_bet (p_bet_id uuid, p_reason text default null) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

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

create function public.approve_cancel_bet (
  p_bet_id uuid,
  p_decision public.bet_approval_decision
) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_total_participants integer;
  v_total_approvals integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_bet from public.bets where id = p_bet_id;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status <> 'cancellation_pending' then
    raise exception 'this bet has no cancellation in progress';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid() and participation_status = 'active'
  ) then
    raise exception 'only a participant can respond to this cancellation';
  end if;
  if exists (
    select 1 from public.bet_cancellation_approvals where bet_id = p_bet_id and user_id = auth.uid()
  ) then
    raise exception 'you have already responded to this cancellation';
  end if;

  insert into public.bet_cancellation_approvals (bet_id, user_id, decision)
  values (p_bet_id, auth.uid(), p_decision);

  if p_decision = 'declined' then
    -- Cancellation attempt fails outright -- the bet stays active exactly
    -- as it was, and the failed attempt's rows are cleared so a future
    -- cancellation proposal starts clean rather than inheriting old
    -- decisions.
    update public.bets set status = 'active' where id = p_bet_id returning * into v_bet;
    delete from public.bet_cancellation_approvals where bet_id = p_bet_id;
    return v_bet;
  end if;

  select count(*) into v_total_participants
  from public.bet_participants
  where bet_id = p_bet_id and participation_status = 'active';

  select count(*) into v_total_approvals
  from public.bet_cancellation_approvals
  where bet_id = p_bet_id and decision = 'approved';

  if v_total_approvals >= v_total_participants then
    update public.bets set status = 'voided' where id = p_bet_id returning * into v_bet;
  end if;

  return v_bet;
end;
$$;

revoke execute on function public.propose_cancel_bet (uuid, text)
from
  public;

revoke execute on function public.approve_cancel_bet (uuid, public.bet_approval_decision)
from
  public;

grant
execute on function public.propose_cancel_bet (uuid, text) to authenticated;

grant
execute on function public.approve_cancel_bet (uuid, public.bet_approval_decision) to authenticated;
