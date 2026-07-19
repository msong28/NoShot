-- Redemption & forgiveness (Milestone 11 / BAL-05, 06, 07).
--
-- BAL-05: full or partial redemption, with the user selecting which
-- underlying obligations it applies to. BAL-06: the debtor submits
-- completion, the creditor confirms (or declines). BAL-07: a creditor may
-- forgive all or part of an obligation, unilaterally -- unlike a manual
-- obligation or a redemption, forgiveness doesn't need the debtor's
-- agreement, so it's a single atomic action rather than a propose/approve
-- pair.
--
-- `obligation_allocations` is the PRD's own named table (§8) for mapping a
-- redemption or forgiveness event back to the specific original ledger
-- entries ("obligations") it draws down, with a per-source amount -- this is
-- what makes "select which underlying obligations" (BAL-05) and per-source
-- "outstanding" tracking possible, and what Appendix B's "redemption amount
-- cannot exceed selected outstanding allocation" is checked against.
--
-- Scope: only `bet_settlement` and `manual_obligation` entries are treated
-- as redeemable/forgivable "obligations" here. `redemption`/`forgiveness`
-- entries obviously can't be redeemed/forgiven again. `correction` is left
-- out too -- nothing writes that entry_type yet (defined in Milestone 9,
-- unused since), and §8.1's phrasing suggests corrections behave more like
-- redemption/forgiveness themselves (a further deduction) than a fresh
-- obligation, which isn't a question this milestone needs to answer.
--
-- Direction trick: same one Milestone 9 relies on for get_my_balances()'s
-- signed netting. To reduce "debtor owes creditor $X", a redemption or
-- forgiveness ledger entry is inserted with debtor/creditor *swapped*
-- relative to the original -- it nets down to the correct remaining balance
-- without get_my_balances() needing any entry-type-specific logic at all.
create type public.redemption_status as enum ('pending', 'confirmed', 'declined', 'cancelled');

create table public.redemption_requests (
  id uuid primary key default gen_random_uuid (),
  debtor_id uuid not null references public.profiles (id) on delete cascade,
  creditor_id uuid not null references public.profiles (id) on delete cascade,
  currency_id uuid not null references public.currencies (id) on delete restrict,
  group_id uuid references public.groups (id) on delete set null,
  amount numeric(12, 2) not null,
  status public.redemption_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint redemption_requests_parties_distinct check (debtor_id <> creditor_id),
  constraint redemption_requests_amount_positive check (amount > 0)
);

create index redemption_requests_debtor_idx on public.redemption_requests (debtor_id);

create index redemption_requests_creditor_idx on public.redemption_requests (creditor_id);

alter table public.redemption_requests enable row level security;

revoke all on public.redemption_requests
from
  anon;

grant
select
  on public.redemption_requests to authenticated;

create policy redemption_requests_select_party on public.redemption_requests for
select
  to authenticated using (
    debtor_id = auth.uid ()
    or creditor_id = auth.uid ()
  );

create table public.forgiveness_events (
  id uuid primary key default gen_random_uuid (),
  creditor_id uuid not null references public.profiles (id) on delete cascade,
  debtor_id uuid not null references public.profiles (id) on delete cascade,
  currency_id uuid not null references public.currencies (id) on delete restrict,
  group_id uuid references public.groups (id) on delete set null,
  amount numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now(),
  constraint forgiveness_events_parties_distinct check (debtor_id <> creditor_id),
  constraint forgiveness_events_amount_positive check (amount > 0),
  constraint forgiveness_events_note_length check (
    note is null
    or char_length(note) <= 200
  )
);

create index forgiveness_events_debtor_idx on public.forgiveness_events (debtor_id);

create index forgiveness_events_creditor_idx on public.forgiveness_events (creditor_id);

alter table public.forgiveness_events enable row level security;

revoke all on public.forgiveness_events
from
  anon;

grant
select
  on public.forgiveness_events to authenticated;

create policy forgiveness_events_select_party on public.forgiveness_events for
select
  to authenticated using (
    debtor_id = auth.uid ()
    or creditor_id = auth.uid ()
  );

create table public.obligation_allocations (
  id uuid primary key default gen_random_uuid (),
  source_entry_id uuid not null references public.ledger_entries (id) on delete cascade,
  redemption_request_id uuid references public.redemption_requests (id) on delete cascade,
  forgiveness_event_id uuid references public.forgiveness_events (id) on delete cascade,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  constraint obligation_allocations_amount_positive check (amount > 0),
  constraint obligation_allocations_exactly_one_parent check (
    (
      (redemption_request_id is not null)::int + (forgiveness_event_id is not null)::int
    ) = 1
  )
);

create index obligation_allocations_source_idx on public.obligation_allocations (source_entry_id);

create index obligation_allocations_redemption_idx on public.obligation_allocations (redemption_request_id);

create index obligation_allocations_forgiveness_idx on public.obligation_allocations (forgiveness_event_id);

alter table public.obligation_allocations enable row level security;

revoke all on public.obligation_allocations
from
  anon;

grant
select
  on public.obligation_allocations to authenticated;

create policy obligation_allocations_select_party on public.obligation_allocations for
select
  to authenticated using (
    exists (
      select 1
      from public.ledger_entries le
      where le.id = source_entry_id
        and (
          le.debtor_id = auth.uid ()
          or le.creditor_id = auth.uid ()
        )
    )
  );

-- BAL-01/02 adjacent: which specific original obligations does the caller
-- have outstanding with a given counterparty (in one currency/group scope),
-- and how much of each is still unredeemed/unforgiven. This is what the
-- redeem/forgive UI selects from.
create function public.get_outstanding_obligations (
  p_counterparty_id uuid,
  p_currency_id uuid,
  p_group_id uuid
) returns table (
  source_entry_id uuid,
  debtor_id uuid,
  creditor_id uuid,
  entry_type public.ledger_entry_type,
  source_type public.ledger_source_type,
  source_id uuid,
  original_amount numeric,
  outstanding_amount numeric,
  created_at timestamptz
) language sql stable security definer
set
  search_path = '' as $$
  with base as (
    select
      le.id,
      le.debtor_id,
      le.creditor_id,
      le.entry_type,
      le.source_type,
      le.source_id,
      le.amount,
      le.amount - coalesce((
        select sum(oa.amount)
        from public.obligation_allocations oa
        left join public.redemption_requests rr on rr.id = oa.redemption_request_id
        where oa.source_entry_id = le.id
          and (oa.forgiveness_event_id is not null or rr.status in ('pending', 'confirmed'))
      ), 0) as outstanding,
      le.created_at
    from public.ledger_entries le
    where le.entry_type in ('bet_settlement', 'manual_obligation')
      and le.currency_id = p_currency_id
      and le.group_id is not distinct from p_group_id
      and (
        (le.debtor_id = auth.uid() and le.creditor_id = p_counterparty_id)
        or (le.creditor_id = auth.uid() and le.debtor_id = p_counterparty_id)
      )
  )
  select id, debtor_id, creditor_id, entry_type, source_type, source_id, amount, outstanding, created_at
  from base
  where outstanding > 0
  order by created_at;
$$;

revoke execute on function public.get_outstanding_obligations (uuid, uuid, uuid)
from
  public;

grant
execute on function public.get_outstanding_obligations (uuid, uuid, uuid) to authenticated;

-- p_allocations: jsonb array of {"source_entry_id": uuid, "amount": numeric}.
-- Locks each selected source row (FOR UPDATE) so two concurrent redemption
-- requests against the same obligation can't both reserve the same
-- outstanding amount -- the second waits for the first's transaction to
-- commit, then sees its reservation in the outstanding computation.
create function public.request_redemption (p_allocations jsonb) returns public.redemption_requests language plpgsql security definer
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

  return v_row;
end;
$$;

create function public.confirm_redemption (p_id uuid) returns public.redemption_requests language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.redemption_requests;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.redemption_requests
  set status = 'confirmed',
      responded_at = now()
  where id = p_id
    and status = 'pending'
    and creditor_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending redemption request found for you to confirm';
  end if;

  insert into public.ledger_entries (
    debtor_id, creditor_id, group_id, currency_id, amount, entry_type, source_type, source_id
  )
  values (
    v_row.creditor_id, v_row.debtor_id, v_row.group_id, v_row.currency_id, v_row.amount,
    'redemption', 'redemption', v_row.id
  );

  return v_row;
end;
$$;

create function public.decline_redemption (p_id uuid) returns public.redemption_requests language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.redemption_requests;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.redemption_requests
  set status = 'declined',
      responded_at = now()
  where id = p_id
    and status = 'pending'
    and creditor_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending redemption request found for you to decline';
  end if;

  return v_row;
end;
$$;

create function public.cancel_redemption (p_id uuid) returns public.redemption_requests language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.redemption_requests;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.redemption_requests
  set status = 'cancelled',
      responded_at = now()
  where id = p_id
    and status = 'pending'
    and debtor_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending redemption request found for you to cancel';
  end if;

  return v_row;
end;
$$;

-- Unlike redemption, forgiveness needs no counterparty approval (BAL-07) --
-- it's the creditor unilaterally writing down what they're owed, so this
-- runs the reservation and the ledger write in the same atomic step rather
-- than a separate request/confirm pair.
create function public.forgive_obligation (p_allocations jsonb, p_note text default null) returns public.forgiveness_events language plpgsql security definer
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

revoke execute on function public.request_redemption (jsonb)
from
  public;

revoke execute on function public.confirm_redemption (uuid)
from
  public;

revoke execute on function public.decline_redemption (uuid)
from
  public;

revoke execute on function public.cancel_redemption (uuid)
from
  public;

revoke execute on function public.forgive_obligation (jsonb, text)
from
  public;

grant
execute on function public.request_redemption (jsonb) to authenticated;

grant
execute on function public.confirm_redemption (uuid) to authenticated;

grant
execute on function public.decline_redemption (uuid) to authenticated;

grant
execute on function public.cancel_redemption (uuid) to authenticated;

grant
execute on function public.forgive_obligation (jsonb, text) to authenticated;
