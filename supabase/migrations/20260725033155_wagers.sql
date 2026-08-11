-- Wagers: a from-scratch replacement for the old bets_core.sql-based
-- create-a-bet flow. Deliberately a separate table family -- bets/
-- bet_versions/bet_sides/bet_participants/bet_commitments/bet_approvals and
-- everything downstream of them (comments, proof_assets, polls, cancellation,
-- resolution, dispute, bet-detail.tsx, bets.tsx, activity.tsx, friends.tsx's
-- head-to-head records, home.tsx) stay completely untouched; this migration
-- adds nothing to and removes nothing from that system. Only web/create.tsx
-- is repointed to this new schema.
--
-- Core design principle: a wager is a single base object -- event + rival +
-- stakes -- plus up to three independently-optional modifiers (deadline,
-- odds, line), each represented as plain nullable columns on `wagers` rather
-- than separate per-modifier tables or a family of bet-type enums. A wager
-- with every modifier off is the simplest, most common case.
--
-- Scope: creation only, ending in 'pending'. Acceptance/settlement/dispute
-- are out of scope for this migration -- wager_status only has one value for
-- now; more get added with a later `alter type ... add value` when that work
-- happens, which is why status is an enum (extensible) rather than a fixed
-- boolean.
--
-- Currency: "money" (no row needed -- the currencies table deliberately has
-- no money category, PRD §5.1 excludes money from stakes) or a reference
-- into the existing, untouched `currencies` table (builtin or owned by the
-- creator, same accessibility rule create_or_counter_bet() already
-- enforced) -- reused here as a shared primitive, not part of this
-- feature's from-scratch redesign, so "custom" stakes are real, moderated,
-- reusable entities instead of throwaway strings. Both sides always stake
-- in the same currency, same invariant the old RPC enforced.
create type public.wager_status as enum ('pending');

create table public.wagers (
  id uuid primary key default gen_random_uuid (),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  rival_id uuid not null references public.profiles (id) on delete cascade,
  event text not null,
  description text not null default '',
  status public.wager_status not null default 'pending',
  created_at timestamptz not null default now(),
  -- Stakes' currency: money, or a currencies row.
  currency_kind text not null,
  currency_id uuid references public.currencies (id),
  -- deadline modifier: null = off.
  deadline timestamptz,
  -- odds modifier: all three null together = off. Ratio is risk:reward in
  -- lowest terms for the favored side -- e.g. 3:1 favoring X means X stakes
  -- 3 units to win 1 unit's worth from the other side, who stakes 1 unit to
  -- win 3. The base stake amount entered at creation is that "1" unit.
  odds_numerator integer,
  odds_denominator integer,
  odds_favors_user_id uuid references public.profiles (id),
  -- line modifier: null = off. Only the creator's over/under position is
  -- stored -- the rival's is always the complement, so storing it would just
  -- be redundant state that could drift.
  line_value numeric,
  line_creator_position text,
  constraint wagers_event_length check (char_length(trim(event)) between 1 and 200),
  constraint wagers_description_length check (char_length(description) <= 2000),
  constraint wagers_creator_not_rival check (creator_id <> rival_id),
  constraint wagers_currency_kind check (currency_kind in ('money', 'custom')),
  constraint wagers_currency_id_matches_kind check (
    (currency_kind = 'money' and currency_id is null)
    or (currency_kind = 'custom' and currency_id is not null)
  ),
  constraint wagers_odds_all_or_nothing check (
    (odds_numerator is null) = (odds_denominator is null)
    and (odds_numerator is null) = (odds_favors_user_id is null)
  ),
  constraint wagers_odds_positive check (
    odds_numerator is null or (odds_numerator > 0 and odds_denominator > 0)
  ),
  constraint wagers_odds_favors_participant check (
    odds_favors_user_id is null or odds_favors_user_id in (creator_id, rival_id)
  ),
  constraint wagers_line_all_or_nothing check ((line_value is null) = (line_creator_position is null)),
  constraint wagers_line_position check (
    line_creator_position is null or line_creator_position in ('over', 'under')
  )
);

create index wagers_creator_idx on public.wagers (creator_id);

create index wagers_rival_idx on public.wagers (rival_id);

create table public.wager_stakes (
  id uuid primary key default gen_random_uuid (),
  wager_id uuid not null references public.wagers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  constraint wager_stakes_amount_positive check (amount > 0),
  unique (wager_id, user_id)
);

alter table public.wagers enable row level security;

alter table public.wager_stakes enable row level security;

revoke all on public.wagers
from
  anon;

revoke all on public.wager_stakes
from
  anon;

-- Only SELECT is granted directly -- every write happens inside
-- create_wager() below, matching the server-authority pattern the old bet
-- system already established (ARCHITECTURE.md §6).
grant
select
  on public.wagers to authenticated;

grant
select
  on public.wager_stakes to authenticated;

-- Always exactly two known parties (1v1 only, per this feature's non-goals),
-- so RLS can check creator_id/rival_id directly -- no recursion-avoidance
-- helper function needed, unlike the old group-aware get_my_bet_ids().
create policy wagers_select on public.wagers for
select
  to authenticated using (
    creator_id = auth.uid ()
    or rival_id = auth.uid ()
  );

create policy wager_stakes_select on public.wager_stakes for
select
  to authenticated using (
    wager_id in (
      select
        id
      from
        public.wagers
      where
        creator_id = auth.uid ()
        or rival_id = auth.uid ()
    )
  );

create function public.create_wager (
  p_event text,
  p_description text,
  p_rival_id uuid,
  p_stake_amount numeric,
  p_currency_kind text,
  p_currency_id uuid,
  p_deadline timestamptz,
  p_odds_numerator integer,
  p_odds_denominator integer,
  p_odds_favors_user_id uuid,
  p_line_value numeric,
  p_line_creator_position text
) returns public.wagers language plpgsql security definer
set
  search_path = '' as $$
declare
  v_wager public.wagers;
  v_creator_amount numeric;
  v_rival_amount numeric;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_rival_id = auth.uid() then
    raise exception 'you cannot wager against yourself';
  end if;
  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = p_rival_id)
        or (requester_id = p_rival_id and addressee_id = auth.uid()))
  ) then
    raise exception 'you can only wager against a friend';
  end if;
  if p_stake_amount is null or p_stake_amount <= 0 then
    raise exception 'stake must be a positive amount';
  end if;
  if p_currency_kind not in ('money', 'custom') then
    raise exception 'invalid currency kind';
  end if;
  if p_currency_kind = 'custom' then
    if not exists (
      select 1 from public.currencies c
      where c.id = p_currency_id
        and c.moderation_status = 'approved'
        and (c.is_builtin or c.owner_user_id = auth.uid())
    ) then
      raise exception 'that currency is not available to you';
    end if;
  end if;
  if public.moderate_text(p_event) = 'block'
    or public.moderate_text(coalesce(p_description, '')) = 'block'
  then
    raise exception 'that wager''s text isn''t allowed';
  end if;

  insert into public.wagers (
    creator_id, rival_id, event, description, currency_kind, currency_id,
    deadline, odds_numerator, odds_denominator, odds_favors_user_id,
    line_value, line_creator_position
  )
  values (
    auth.uid(), p_rival_id, trim(p_event), coalesce(p_description, ''),
    p_currency_kind, p_currency_id,
    p_deadline, p_odds_numerator, p_odds_denominator, p_odds_favors_user_id,
    p_line_value, p_line_creator_position
  )
  returning * into v_wager;

  if p_odds_numerator is not null then
    if p_odds_favors_user_id = auth.uid() then
      v_creator_amount := p_stake_amount * p_odds_numerator;
      v_rival_amount := p_stake_amount * p_odds_denominator;
    else
      v_creator_amount := p_stake_amount * p_odds_denominator;
      v_rival_amount := p_stake_amount * p_odds_numerator;
    end if;
  else
    v_creator_amount := p_stake_amount;
    v_rival_amount := p_stake_amount;
  end if;

  insert into public.wager_stakes (wager_id, user_id, amount)
  values
    (v_wager.id, auth.uid(), v_creator_amount),
    (v_wager.id, p_rival_id, v_rival_amount);

  return v_wager;
end;
$$;

revoke execute on function public.create_wager (
  text, text, uuid, numeric, text, uuid, timestamptz, integer, integer, uuid,
  numeric, text
)
from
  public;

grant
execute on function public.create_wager (
  text, text, uuid, numeric, text, uuid, timestamptz, integer, integer, uuid,
  numeric, text
) to authenticated;
