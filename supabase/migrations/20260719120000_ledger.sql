-- Ledger & balances (Milestone 9 / BAL-01, 02, 08; §5.5, §8.1). This is the
-- table two earlier milestones were explicitly built to hand off to:
--
-- - Milestone 8's confirm_bet_result()/resolve_dispute()/vote_on_dispute()/
--   trigger_random_fallback() all funnel through one shared internal helper,
--   _finalize_bet_resolution(), specifically so the actual ledger-posting
--   step could be added in exactly one place later rather than four. That's
--   what this migration does, via CREATE OR REPLACE FUNCTION with the same
--   signature -- not an edit of the already-pushed migration that first
--   defined it, a new migration replacing its body, same as how a table
--   gets a follow-up migration rather than being rewritten in place.
-- - Milestone 10's approve_manual_obligation() deliberately left an
--   approved proposal sitting with no ledger effect, documented at the time
--   as "wiring the actual balance-affecting write is left for whenever
--   Milestone 9 lands." Same CREATE OR REPLACE treatment here.
--
-- Payout allocation model: for a resolved (non-tied) bet, the losing side's
-- combined stake is distributed pro-rata across winners in proportion to
-- each winner's own payout_if_win (computed at commitment time, §5.3).
-- Concretely: debtor_j owes creditor_i = stake_j * (payout_i / total_losing_pool).
-- This reduces to the simple case for a 1-vs-1 bet (the loser owes exactly
-- the winner's payout_if_win) and generalizes correctly to N-vs-N: summed
-- over all losers, each winner receives exactly their own payout_if_win;
-- summed over all winners, each loser owes at most their own stake (exactly
-- their stake if the bet was fully funded, per BET-05's <= check at
-- creation time -- never more, since that's what BET-05 already guarantees).
create type public.ledger_entry_type as enum (
  'bet_settlement',
  'manual_obligation',
  'redemption',
  'forgiveness',
  'correction'
);

create type public.ledger_source_type as enum ('bet', 'manual_obligation', 'redemption', 'forgiveness');

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid (),
  debtor_id uuid not null references public.profiles (id) on delete cascade,
  creditor_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  currency_id uuid not null references public.currencies (id),
  amount numeric(12, 2) not null,
  entry_type public.ledger_entry_type not null,
  source_type public.ledger_source_type not null,
  source_id uuid not null,
  reversal_of uuid references public.ledger_entries (id),
  created_at timestamptz not null default now(),
  constraint ledger_entries_amount_positive check (amount > 0),
  constraint ledger_entries_parties_distinct check (debtor_id <> creditor_id)
);

create index ledger_entries_debtor_idx on public.ledger_entries (debtor_id);

create index ledger_entries_creditor_idx on public.ledger_entries (creditor_id);

create index ledger_entries_source_idx on public.ledger_entries (source_type, source_id);

-- Append-only: reject any attempt to UPDATE or DELETE, no matter which role
-- issues it -- corrections are new reversal entries (reversal_of), never
-- edits (§8.1: "Never UPDATE or DELETE financial/obligation history in place").
create function public.ledger_entries_prevent_mutation () returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only -- corrections must be new reversal entries, not edits';
end;
$$;

create trigger ledger_entries_no_update before
update on public.ledger_entries for each row
execute function public.ledger_entries_prevent_mutation ();

create trigger ledger_entries_no_delete before delete on public.ledger_entries for each row
execute function public.ledger_entries_prevent_mutation ();

alter table public.ledger_entries enable row level security;

revoke all on public.ledger_entries
from
  anon;

-- Read-only direct access, same as bet_result_submissions etc. -- every
-- write happens inside SECURITY DEFINER functions, never granted directly.
grant
select
  on public.ledger_entries to authenticated;

create policy ledger_entries_select on public.ledger_entries for
select
  to authenticated using (
    debtor_id = auth.uid ()
    or creditor_id = auth.uid ()
  );

-- BAL-01: consolidated balances by counterparty/group/currency. Unlike
-- get_bet_payout_preview() (which relies purely on RLS-filtered joins and
-- never calls auth.uid() itself), this calls auth.uid() directly in its own
-- body -- that requires SECURITY DEFINER, same as every other direct caller
-- of auth.uid() in this codebase (a plain function body doesn't get the
-- same implicit access to the auth schema that RLS policy expressions do).
-- ledger_entries' own RLS still independently restricts the underlying rows
-- to ones the caller is a party to.
-- Net > 0 means the counterparty owes the caller; net < 0 means the caller
-- owes the counterparty. Zero-sum pairs are dropped (nothing outstanding).
create function public.get_my_balances () returns table (
  counterparty_id uuid,
  group_id uuid,
  currency_id uuid,
  net_amount numeric
) language sql stable security definer
set
  search_path = '' as $$
  select
    case when debtor_id = auth.uid() then creditor_id else debtor_id end as counterparty_id,
    group_id,
    currency_id,
    sum(case when creditor_id = auth.uid() then amount else -amount end) as net_amount
  from public.ledger_entries
  where debtor_id = auth.uid() or creditor_id = auth.uid()
  group by counterparty_id, group_id, currency_id
  having sum(case when creditor_id = auth.uid() then amount else -amount end) <> 0;
$$;

revoke execute on function public.get_my_balances ()
from
  public;

grant
execute on function public.get_my_balances () to authenticated;

-- Extends Milestone 8's shared resolution finalizer to actually post the
-- ledger entries RES-07 calls for, atomically with the status change that
-- was already happening here. A tie posts nothing (RES-06).
create or replace function public._finalize_bet_resolution (p_bet_id uuid, p_outcome_key text) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_currency_id uuid;
  v_total_losing_pool numeric;
  v_loser record;
  v_winner record;
  v_amount numeric;
begin
  update public.bets
  set status = (case when p_outcome_key = 'tie' then 'tied' else 'resolved' end)::public.bet_status,
      resolved_at = now(),
      resolved_outcome_key = p_outcome_key
  where id = p_bet_id
  returning * into v_bet;

  if p_outcome_key = 'tie' then
    return v_bet;
  end if;

  select bc.currency_id into v_currency_id
  from public.bet_commitments bc
  where bc.bet_id = p_bet_id and bc.version_no = v_bet.current_version
  limit 1;

  select coalesce(sum(bc.stake_quantity), 0) into v_total_losing_pool
  from public.bet_commitments bc
  join public.bet_participants bp on bp.id = bc.participant_id
  join public.bet_sides bs on bs.id = bp.side_id
  where bc.bet_id = p_bet_id and bc.version_no = v_bet.current_version
    and bs.outcome_key <> p_outcome_key;

  if v_total_losing_pool <= 0 then
    return v_bet;
  end if;

  for v_loser in
    select bp.user_id, bc.stake_quantity
    from public.bet_commitments bc
    join public.bet_participants bp on bp.id = bc.participant_id
    join public.bet_sides bs on bs.id = bp.side_id
    where bc.bet_id = p_bet_id and bc.version_no = v_bet.current_version
      and bs.outcome_key <> p_outcome_key
  loop
    for v_winner in
      select bp.user_id, bc.payout_if_win
      from public.bet_commitments bc
      join public.bet_participants bp on bp.id = bc.participant_id
      join public.bet_sides bs on bs.id = bp.side_id
      where bc.bet_id = p_bet_id and bc.version_no = v_bet.current_version
        and bs.outcome_key = p_outcome_key
    loop
      v_amount := round(v_loser.stake_quantity * (v_winner.payout_if_win / v_total_losing_pool), 2);
      if v_amount > 0 then
        insert into public.ledger_entries (
          debtor_id, creditor_id, group_id, currency_id, amount, entry_type, source_type, source_id
        )
        values (
          v_loser.user_id, v_winner.user_id, v_bet.group_id, v_currency_id, v_amount,
          'bet_settlement', 'bet', p_bet_id
        );
      end if;
    end loop;
  end loop;

  return v_bet;
end;
$$;

-- Extends Milestone 10's approve_manual_obligation() to post the ledger
-- entry once approved, per BAL-03/04 ("only after all affected users
-- approve," never a direct edit).
create or replace function public.approve_manual_obligation (p_id uuid) returns public.manual_obligation_proposals language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.manual_obligation_proposals;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.manual_obligation_proposals
  set status = 'approved',
      responded_at = now()
  where id = p_id
    and status = 'pending'
    and auth.uid() <> proposer_id
    and (debtor_id = auth.uid() or creditor_id = auth.uid())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending obligation proposal found for you to approve';
  end if;

  insert into public.ledger_entries (
    debtor_id, creditor_id, group_id, currency_id, amount, entry_type, source_type, source_id
  )
  values (
    v_row.debtor_id, v_row.creditor_id, null, v_row.currency_id, v_row.amount,
    'manual_obligation', 'manual_obligation', v_row.id
  );

  return v_row;
end;
$$;
