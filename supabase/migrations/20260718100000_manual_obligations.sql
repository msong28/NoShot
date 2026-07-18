-- Manual obligations (Milestone 10 / BAL-03, BAL-04).
--
-- Lets one friend propose an obligation outside the bet engine ("I owe you
-- $5 for gas") that only becomes real once the other party approves it --
-- BAL-03 ("only after all affected users approve") and BAL-04 ("proposed
-- adjustments, never direct balance edits"). Same propose/approve shape as
-- friend requests and group invites: the proposer is implicitly the first
-- "approval", the counterparty's explicit approve/decline is the second.
--
-- Scope note: this does NOT yet write anything to a ledger -- `ledger_entries`
-- is Milestone 9's table and doesn't exist yet. An approved row here just
-- sits in `approved` state; wiring the actual balance-affecting write is
-- deliberately left for whenever Milestone 9 lands (see PROJECT_STATUS.md).
create type public.manual_obligation_status as enum ('pending', 'approved', 'declined', 'cancelled');

create table public.manual_obligation_proposals (
  id uuid primary key default gen_random_uuid (),
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  debtor_id uuid not null references public.profiles (id) on delete cascade,
  creditor_id uuid not null references public.profiles (id) on delete cascade,
  currency_id uuid not null references public.currencies (id) on delete restrict,
  amount numeric(12, 2) not null,
  description text not null,
  status public.manual_obligation_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint manual_obligation_proposals_parties_distinct check (debtor_id <> creditor_id),
  constraint manual_obligation_proposals_proposer_is_party check (
    proposer_id = debtor_id
    or proposer_id = creditor_id
  ),
  constraint manual_obligation_proposals_amount_positive check (amount > 0),
  constraint manual_obligation_proposals_description_length check (
    char_length(trim(description)) between 1 and 200
  )
);

create index manual_obligation_proposals_debtor_idx on public.manual_obligation_proposals (debtor_id);

create index manual_obligation_proposals_creditor_idx on public.manual_obligation_proposals (creditor_id);

alter table public.manual_obligation_proposals enable row level security;

revoke all on public.manual_obligation_proposals
from
  anon;

-- Read-only direct access; every write (propose/approve/decline/cancel)
-- happens inside the functions below -- see ARCHITECTURE.md #6, this table
-- is explicitly called out as RPC-only.
grant
select
  on public.manual_obligation_proposals to authenticated;

create policy manual_obligation_proposals_select_party on public.manual_obligation_proposals for
select
  to authenticated using (
    debtor_id = auth.uid ()
    or creditor_id = auth.uid ()
  );

-- Friends-only for now (matches the "propose to a friend" flow this ships
-- with -- picking a counterparty from an already-loaded friends list, same
-- as the UI does for group invites). Revisit if group-scoped-but-not-friend
-- obligations turn out to be wanted later.
create function public.propose_manual_obligation (
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

create function public.approve_manual_obligation (p_id uuid) returns public.manual_obligation_proposals language plpgsql security definer
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

  return v_row;
end;
$$;

create function public.decline_manual_obligation (p_id uuid) returns public.manual_obligation_proposals language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.manual_obligation_proposals;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.manual_obligation_proposals
  set status = 'declined',
      responded_at = now()
  where id = p_id
    and status = 'pending'
    and auth.uid() <> proposer_id
    and (debtor_id = auth.uid() or creditor_id = auth.uid())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending obligation proposal found for you to decline';
  end if;

  return v_row;
end;
$$;

create function public.cancel_manual_obligation (p_id uuid) returns public.manual_obligation_proposals language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.manual_obligation_proposals;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.manual_obligation_proposals
  set status = 'cancelled',
      responded_at = now()
  where id = p_id
    and status = 'pending'
    and proposer_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending obligation proposal found for you to cancel';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.propose_manual_obligation (uuid, uuid, uuid, numeric, text)
from
  public;

revoke execute on function public.approve_manual_obligation (uuid)
from
  public;

revoke execute on function public.decline_manual_obligation (uuid)
from
  public;

revoke execute on function public.cancel_manual_obligation (uuid)
from
  public;

grant
execute on function public.propose_manual_obligation (uuid, uuid, uuid, numeric, text) to authenticated;

grant
execute on function public.approve_manual_obligation (uuid) to authenticated;

grant
execute on function public.decline_manual_obligation (uuid) to authenticated;

grant
execute on function public.cancel_manual_obligation (uuid) to authenticated;
