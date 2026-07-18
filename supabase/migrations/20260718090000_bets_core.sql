-- Bet engine core (Milestone 6 / BET-01..10). draft -> versions -> approvals,
-- per Appendix A.1/A.2 and the Milestone-6 scope in IMPLEMENTATION_PLAN.md.
-- Cancellation (cancellation_pending/voided-via-cancellation) is Milestone 7;
-- result submission/dispute (pending_result/disputed/resolved) is Milestone 8;
-- real ledger writes are Milestone 9. `voided` here is reached only via an
-- outright decline during negotiation -- see create_or_counter_bet() below.
--
-- Payout model (PRD §5.3): each commitment declares its own stake and a
-- personal odds ratio (numerator:denominator = risk:reward in lowest terms).
-- payout_if_win = stake_quantity * odds_denominator / odds_numerator. Funding
-- validation (BET-05) checks, for every possible winning side, that the sum
-- of that side's payouts does not exceed the stake pool committed by every
-- other side. Exact person-to-person allocation of a shared pool across
-- multiple losers/winners is Milestone 9's job (confirm_bet_result()), once
-- there's an actual result to settle -- this migration only needs the
-- creation-time funding check and a preview, not a final ledger split.
create type public.bet_status as enum ('draft', 'pending_acceptance', 'active', 'voided');

create type public.bet_version_status as enum ('draft', 'proposed', 'approved');

create type public.bet_resolution_method as enum ('participant_submission', 'judge', 'group_vote');

create type public.bet_participant_role as enum ('creator', 'participant');

create type public.bet_participation_status as enum ('active', 'removed');

create type public.bet_approval_decision as enum ('approved', 'declined');

create table public.bets (
  id uuid primary key default gen_random_uuid (),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  title text not null,
  description text not null default '',
  current_version integer not null default 1,
  status public.bet_status not null default 'draft',
  deadline timestamptz,
  resolution_method public.bet_resolution_method not null default 'participant_submission',
  judge_id uuid references public.profiles (id) on delete set null,
  random_fallback_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  resolved_at timestamptz,
  constraint bets_title_length check (char_length(trim(title)) between 1 and 100),
  constraint bets_description_length check (char_length(description) <= 2000),
  constraint bets_judge_not_creator check (judge_id is distinct from creator_id)
);

create index bets_group_idx on public.bets (group_id);

create table public.bet_versions (
  bet_id uuid not null references public.bets (id) on delete cascade,
  version_no integer not null,
  status public.bet_version_status not null default 'proposed',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  supersedes_version integer,
  primary key (bet_id, version_no)
);

create table public.bet_sides (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  version_no integer not null,
  label text not null,
  outcome_key text not null,
  foreign key (bet_id, version_no) references public.bet_versions (bet_id, version_no) on delete cascade,
  unique (bet_id, version_no, outcome_key),
  constraint bet_sides_label_length check (char_length(trim(label)) between 1 and 50)
);

-- Not versioned, per §8's own table listing (unlike sides/commitments/approvals):
-- one row per (bet, user) tracks current membership + which current-version
-- side they're assigned to. A counteroffer repoints side_id in place rather
-- than creating new participant rows, so a participant's identity is stable
-- across versions even as terms change.
create table public.bet_participants (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  side_id uuid not null references public.bet_sides (id) on delete cascade,
  role public.bet_participant_role not null default 'participant',
  participation_status public.bet_participation_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (bet_id, user_id)
);

create index bet_participants_user_idx on public.bet_participants (user_id);

create table public.bet_commitments (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  version_no integer not null,
  participant_id uuid not null references public.bet_participants (id) on delete cascade,
  currency_id uuid not null references public.currencies (id),
  stake_quantity numeric(12, 2) not null,
  odds_numerator integer not null,
  odds_denominator integer not null,
  payout_if_win numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  foreign key (bet_id, version_no) references public.bet_versions (bet_id, version_no) on delete cascade,
  unique (bet_id, version_no, participant_id),
  constraint bet_commitments_stake_positive check (stake_quantity > 0),
  constraint bet_commitments_odds_positive check (odds_numerator > 0 and odds_denominator > 0),
  constraint bet_commitments_payout_positive check (payout_if_win > 0)
);

create table public.bet_approvals (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  version_no integer not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  decision public.bet_approval_decision not null,
  created_at timestamptz not null default now(),
  foreign key (bet_id, version_no) references public.bet_versions (bet_id, version_no) on delete cascade,
  unique (bet_id, version_no, user_id)
);

alter table public.bets enable row level security;

alter table public.bet_versions enable row level security;

alter table public.bet_sides enable row level security;

alter table public.bet_participants enable row level security;

alter table public.bet_commitments enable row level security;

alter table public.bet_approvals enable row level security;

revoke all on public.bets
from
  anon;

revoke all on public.bet_versions
from
  anon;

revoke all on public.bet_sides
from
  anon;

revoke all on public.bet_participants
from
  anon;

revoke all on public.bet_commitments
from
  anon;

revoke all on public.bet_approvals
from
  anon;

-- Every write to every table in this migration happens inside the
-- SECURITY DEFINER functions below -- see ARCHITECTURE.md §6. Only SELECT is
-- ever granted directly, matching bet_versions/bet_approvals already being
-- called out as RPC-only there; the full set (bets, bet_sides,
-- bet_participants, bet_commitments) shares the same money/state-machine
-- rationale and is added to that list as part of this migration.
grant
select
  on public.bets to authenticated;

grant
select
  on public.bet_versions to authenticated;

grant
select
  on public.bet_sides to authenticated;

grant
select
  on public.bet_participants to authenticated;

grant
select
  on public.bet_commitments to authenticated;

grant
select
  on public.bet_approvals to authenticated;

-- security definer: same recursion-avoidance reasoning as get_my_group_ids().
create function public.get_my_bet_ids () returns setof uuid language sql stable security definer
set
  search_path = '' as $$
  select bet_id from public.bet_participants where user_id = auth.uid();
$$;

-- Participants get full-detail access. Group members who aren't (yet)
-- participants can still see that a bet exists in their group (GR-04's
-- "group overview shows... active bets"), but not its sides/commitments/
-- approvals -- those stay strictly participant-gated below.
create policy bets_select on public.bets for
select
  to authenticated using (
    id in (
      select
        public.get_my_bet_ids ()
    )
    or (
      group_id is not null
      and group_id in (
        select
          public.get_my_group_ids ()
      )
    )
  );

create policy bet_versions_select on public.bet_versions for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy bet_sides_select on public.bet_sides for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy bet_participants_select on public.bet_participants for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy bet_commitments_select on public.bet_commitments for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy bet_approvals_select on public.bet_approvals for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
  );

-- Handles both a brand-new bet (p_bet_id null) and a counteroffer on an
-- existing one still being negotiated (p_bet_id set, status draft/
-- pending_acceptance/active). propose_bet_amendment() below is a thin
-- wrapper over this same logic, restricted to status = 'active'.
create function public.create_or_counter_bet (
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
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if jsonb_array_length(p_sides) < 2 then
    raise exception 'a bet needs at least two possible outcomes';
  end if;
  if jsonb_array_length(p_participants) < 2 then
    raise exception 'a bet needs at least two participants';
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
  end if;

  return v_bet;
end;
$$;

create function public.approve_bet_version (
  p_bet_id uuid,
  p_version_no integer,
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
  if v_bet.current_version <> p_version_no then
    raise exception 'a newer version exists -- refresh and try again';
  end if;
  if v_bet.status not in ('pending_acceptance', 'active') then
    raise exception 'this bet is not awaiting approval';
  end if;
  if not exists (
    select 1 from public.bet_participants where bet_id = p_bet_id and user_id = auth.uid()
  ) then
    raise exception 'only a participant can approve this bet';
  end if;
  if exists (
    select 1 from public.bet_approvals
    where bet_id = p_bet_id and version_no = p_version_no and user_id = auth.uid()
  ) then
    raise exception 'you have already responded to this version';
  end if;

  insert into public.bet_approvals (bet_id, version_no, user_id, decision)
  values (p_bet_id, p_version_no, auth.uid(), p_decision);

  if p_decision = 'declined' then
    -- An outright decline before/without ever having been active kills the
    -- proposal outright -- there's nothing agreed yet to formally cancel.
    -- Undoing an *active* bet goes through Milestone 7's cancellation flow
    -- instead, which requires mutual approval since both sides already agreed.
    update public.bets set status = 'voided' where id = p_bet_id returning * into v_bet;
    return v_bet;
  end if;

  select count(*) into v_total_participants
  from public.bet_participants
  where bet_id = p_bet_id and participation_status = 'active';

  select count(*) into v_total_approvals
  from public.bet_approvals
  where bet_id = p_bet_id and version_no = p_version_no and decision = 'approved';

  if v_total_approvals >= v_total_participants then
    update public.bets
    set status = 'active',
        activated_at = coalesce(activated_at, now())
    where id = p_bet_id
    returning * into v_bet;

    update public.bet_versions set status = 'approved'
    where bet_id = p_bet_id and version_no = p_version_no;
  end if;

  return v_bet;
end;
$$;

create function public.propose_bet_amendment (
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
begin
  select * into v_bet from public.bets where id = p_bet_id;
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;
  if v_bet.status <> 'active' then
    raise exception 'only an active bet can be amended -- use create_or_counter_bet while still negotiating';
  end if;

  return public.create_or_counter_bet(
    p_bet_id, v_bet.group_id, p_title, p_description, p_deadline,
    p_resolution_method, p_judge_id, p_random_fallback_enabled,
    p_sides, p_participants, false
  );
end;
$$;

-- BET-10: minimal draft-save support. create_or_counter_bet(p_is_draft :=
-- true) writes a private draft only the creator can see (bets_select's
-- participant-only branch already covers this -- a draft has no other
-- participants with 'active' bet_approvals rows yet, but they *are* already
-- bet_participants rows, so they'd see it prematurely; submit_draft_bet is
-- the only path that actually notifies/exposes it as a real proposal).
create function public.submit_draft_bet (p_bet_id uuid) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_bet from public.bets where id = p_bet_id and creator_id = auth.uid();
  if v_bet.id is null then
    raise exception 'draft not found';
  end if;
  if v_bet.status <> 'draft' then
    raise exception 'this bet is not a draft';
  end if;

  update public.bets set status = 'pending_acceptance' where id = p_bet_id returning * into v_bet;
  update public.bet_versions set status = 'proposed'
  where bet_id = p_bet_id and version_no = v_bet.current_version;

  insert into public.bet_approvals (bet_id, version_no, user_id, decision)
  values (p_bet_id, v_bet.current_version, auth.uid(), 'approved')
  on conflict (bet_id, version_no, user_id) do nothing;

  return v_bet;
end;
$$;

-- Read-only, SECURITY INVOKER (the default) so RLS on the underlying tables
-- naturally restricts this to bets the caller participates in -- a
-- non-participant gets zero rows back, no separate check needed here.
-- Feeds both the creation wizard's payout-matrix preview (BET-04) and the
-- bet detail screen later.
create function public.get_bet_payout_preview (p_bet_id uuid, p_version_no integer) returns table (
  outcome_key text,
  user_id uuid,
  amount numeric
) language sql stable
set
  search_path = '' as $$
  select
    outcomes.outcome_key,
    bp.user_id,
    case when bs.outcome_key = outcomes.outcome_key then bc.payout_if_win else -bc.stake_quantity end as amount
  from public.bet_sides outcomes
  join public.bet_commitments bc
    on bc.bet_id = outcomes.bet_id and bc.version_no = outcomes.version_no
  join public.bet_participants bp on bp.id = bc.participant_id
  join public.bet_sides bs on bs.id = bp.side_id
  where outcomes.bet_id = p_bet_id and outcomes.version_no = p_version_no
  order by outcomes.outcome_key, bp.user_id;
$$;

revoke execute on function public.create_or_counter_bet (
  uuid, uuid, text, text, timestamptz, public.bet_resolution_method, uuid,
  boolean, jsonb, jsonb, boolean
)
from
  public;

revoke execute on function public.approve_bet_version (uuid, integer, public.bet_approval_decision)
from
  public;

revoke execute on function public.propose_bet_amendment (
  uuid, text, text, timestamptz, public.bet_resolution_method, uuid, boolean, jsonb, jsonb
)
from
  public;

revoke execute on function public.submit_draft_bet (uuid)
from
  public;

revoke execute on function public.get_bet_payout_preview (uuid, integer)
from
  public;

revoke execute on function public.get_my_bet_ids ()
from
  public;

grant
execute on function public.create_or_counter_bet (
  uuid, uuid, text, text, timestamptz, public.bet_resolution_method, uuid,
  boolean, jsonb, jsonb, boolean
) to authenticated;

grant
execute on function public.approve_bet_version (uuid, integer, public.bet_approval_decision) to authenticated;

grant
execute on function public.propose_bet_amendment (
  uuid, text, text, timestamptz, public.bet_resolution_method, uuid, boolean, jsonb, jsonb
) to authenticated;

grant
execute on function public.submit_draft_bet (uuid) to authenticated;

grant
execute on function public.get_bet_payout_preview (uuid, integer) to authenticated;

grant
execute on function public.get_my_bet_ids () to authenticated;
