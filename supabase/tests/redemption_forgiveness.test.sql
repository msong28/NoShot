-- Behaviour test for redemption & forgiveness (Milestone 11 / BAL-05, 06, 07).
-- Same convention as the other behaviour tests: must ERROR on any failed
-- assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'); -- carol (uninvolved)

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'alice',
    'Alice',
    2000,
    now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'bob',
    'Bob',
    1998,
    now()
  ),
  (
    'cccccccc-0000-0000-0000-000000000003',
    'carol',
    'Carol',
    1997,
    now()
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002');
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_friendship_id uuid;
begin
  select id into v_friendship_id from public.friendships
  where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001' and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  perform public.respond_friend_request(v_friendship_id, true);
end;
$$;

-- Alice proposes, Bob approves: alice owes bob 10 Meal, no group.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_meal_id uuid;
  v_proposal_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  perform set_config('test.meal_id', v_meal_id::text, false);

  select id into v_proposal_id from public.propose_manual_obligation(
    'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', v_meal_id, 10, 'Groceries'
  );
  perform set_config('test.proposal_id', v_proposal_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_manual_obligation(current_setting('test.proposal_id')::uuid);
end;
$$;

do $$
declare
  v_source_id uuid;
begin
  select id into v_source_id from public.ledger_entries where source_id = current_setting('test.proposal_id')::uuid;
  perform set_config('test.source_id', v_source_id::text, false);
end;
$$;

-- get_outstanding_obligations shows alice's full 10 outstanding to bob.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_outstanding numeric;
begin
  select outstanding_amount into v_outstanding
  from public.get_outstanding_obligations('bbbbbbbb-0000-0000-0000-000000000002', current_setting('test.meal_id')::uuid, null)
  where source_entry_id = current_setting('test.source_id')::uuid;
  if v_outstanding <> 10 then
    raise exception 'FAIL: expected 10 outstanding before any redemption, got %', v_outstanding;
  end if;
  raise notice 'PASS: get_outstanding_obligations shows the full amount outstanding';
end;
$$;

-- Only the debtor (alice) can request redemption -- bob (creditor) cannot.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform public.request_redemption(jsonb_build_array(
      jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 4)
    ));
    raise exception 'FAIL: expected the creditor to be rejected from requesting redemption';
  exception
    when others then
      if sqlerrm not like '%only the debtor%' then
        raise;
      end if;
      raise notice 'PASS: only the debtor can request redemption';
  end;
end;
$$;

-- Alice (debtor) partially redeems 4 of the 10.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_request_id uuid;
  v_status public.redemption_status;
  v_outstanding numeric;
begin
  select id, status into v_request_id, v_status from public.request_redemption(jsonb_build_array(
    jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 4)
  ));
  perform set_config('test.redemption_id', v_request_id::text, false);
  if v_status <> 'pending' then
    raise exception 'FAIL: expected a fresh redemption request to be pending, got %', v_status;
  end if;

  -- The reservation counts immediately, even before confirmation.
  select outstanding_amount into v_outstanding
  from public.get_outstanding_obligations('bbbbbbbb-0000-0000-0000-000000000002', current_setting('test.meal_id')::uuid, null)
  where source_entry_id = current_setting('test.source_id')::uuid;
  if v_outstanding <> 6 then
    raise exception 'FAIL: expected 6 outstanding after a pending 4 reservation, got %', v_outstanding;
  end if;
  raise notice 'PASS: a pending redemption request reserves its amount against future double-spend';
end;
$$;

-- A second redemption request for more than what's left (7 > 6 remaining)
-- is rejected.
do $$
begin
  begin
    perform public.request_redemption(jsonb_build_array(
      jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 7)
    ));
    raise exception 'FAIL: expected a request exceeding the outstanding amount to be rejected';
  exception
    when others then
      if sqlerrm not like '%exceeds the outstanding balance%' then
        raise;
      end if;
      raise notice 'PASS: cannot request redemption for more than what remains outstanding';
  end;
end;
$$;

-- Only the creditor (bob) can confirm -- alice (debtor) cannot confirm her
-- own request.
do $$
begin
  begin
    perform public.confirm_redemption(current_setting('test.redemption_id')::uuid);
    raise exception 'FAIL: expected the debtor to be rejected from confirming their own redemption';
  exception
    when others then
      if sqlerrm not like '%no pending redemption request found%' then
        raise;
      end if;
      raise notice 'PASS: the debtor cannot confirm their own redemption request';
  end;
end;
$$;

-- Bob confirms: a redemption ledger entry appears, swapped direction.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
  v_debtor uuid;
  v_creditor uuid;
  v_amount numeric;
begin
  perform public.confirm_redemption(current_setting('test.redemption_id')::uuid);

  select count(*) into v_count from public.ledger_entries
  where source_type = 'redemption' and source_id = current_setting('test.redemption_id')::uuid;
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 redemption ledger entry, got %', v_count;
  end if;

  select debtor_id, creditor_id, amount into v_debtor, v_creditor, v_amount
  from public.ledger_entries
  where source_type = 'redemption' and source_id = current_setting('test.redemption_id')::uuid;
  if v_debtor <> 'bbbbbbbb-0000-0000-0000-000000000002'
    or v_creditor <> 'aaaaaaaa-0000-0000-0000-000000000001'
    or v_amount <> 4 then
    raise exception 'FAIL: expected the redemption entry to swap direction (bob owes alice 4), got debtor=% creditor=% amount=%', v_debtor, v_creditor, v_amount;
  end if;
  raise notice 'PASS: confirming a redemption posts a swapped-direction settlement entry';
end;
$$;

-- Net balance between alice and bob now nets 10 owed minus 4 redeemed = 6.
do $$
declare
  v_net numeric;
begin
  select net_amount into v_net from public.get_my_balances()
  where counterparty_id = 'aaaaaaaa-0000-0000-0000-000000000001' and currency_id = current_setting('test.meal_id')::uuid;
  if v_net <> 6 then
    raise exception 'FAIL: expected bob to be owed 6 after the partial redemption, got %', v_net;
  end if;
  raise notice 'PASS: a confirmed redemption correctly reduces the net balance';
end;
$$;

-- A confirmed request can't be confirmed again.
do $$
begin
  begin
    perform public.confirm_redemption(current_setting('test.redemption_id')::uuid);
    raise exception 'FAIL: expected confirming an already-confirmed redemption to be rejected';
  exception
    when others then
      if sqlerrm not like '%no pending redemption request found%' then
        raise;
      end if;
      raise notice 'PASS: a redemption request cannot be confirmed twice';
  end;
end;
$$;

-- Alice requests redemption of the remaining 6, then cancels it herself --
-- the reservation is released and the full 6 becomes selectable again.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_request_id uuid;
begin
  select id into v_request_id from public.request_redemption(jsonb_build_array(
    jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 6)
  ));
  perform set_config('test.cancel_request_id', v_request_id::text, false);
  perform public.cancel_redemption(v_request_id);
end;
$$;

do $$
declare
  v_outstanding numeric;
begin
  select outstanding_amount into v_outstanding
  from public.get_outstanding_obligations('bbbbbbbb-0000-0000-0000-000000000002', current_setting('test.meal_id')::uuid, null)
  where source_entry_id = current_setting('test.source_id')::uuid;
  if v_outstanding <> 6 then
    raise exception 'FAIL: expected a cancelled request to release its reservation, got %', v_outstanding;
  end if;
  raise notice 'PASS: cancelling a redemption request releases its reservation';
end;
$$;

-- Alice requests the remaining 6 again; bob declines it this time -- also
-- releases the reservation.
do $$
declare
  v_request_id uuid;
begin
  select id into v_request_id from public.request_redemption(jsonb_build_array(
    jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 6)
  ));
  perform set_config('test.decline_request_id', v_request_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.redemption_status;
begin
  select status into v_status from public.decline_redemption(current_setting('test.decline_request_id')::uuid);
  if v_status <> 'declined' then
    raise exception 'FAIL: expected the redemption request to be declined, got %', v_status;
  end if;
  raise notice 'PASS: the creditor can decline a redemption request';
end;
$$;

-- Only the creditor (bob) can forgive -- alice (debtor) cannot forgive her
-- own debt.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.forgive_obligation(jsonb_build_array(
      jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 2)
    ), null);
    raise exception 'FAIL: expected the debtor to be rejected from forgiving their own obligation';
  exception
    when others then
      if sqlerrm not like '%only the creditor%' then
        raise;
      end if;
      raise notice 'PASS: only the creditor can forgive an obligation';
  end;
end;
$$;

-- Bob (creditor) forgives 2 of the remaining 6, with a note.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_event_id uuid;
  v_note text;
  v_count integer;
  v_debtor uuid;
  v_creditor uuid;
  v_amount numeric;
begin
  select id, note into v_event_id, v_note from public.forgive_obligation(jsonb_build_array(
    jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 2)
  ), 'good sport');
  perform set_config('test.forgiveness_id', v_event_id::text, false);
  if v_note <> 'good sport' then
    raise exception 'FAIL: expected the forgiveness note to be saved, got %', v_note;
  end if;

  select count(*) into v_count from public.ledger_entries
  where source_type = 'forgiveness' and source_id = v_event_id;
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 forgiveness ledger entry, got %', v_count;
  end if;

  select debtor_id, creditor_id, amount into v_debtor, v_creditor, v_amount
  from public.ledger_entries where source_type = 'forgiveness' and source_id = v_event_id;
  if v_debtor <> 'bbbbbbbb-0000-0000-0000-000000000002'
    or v_creditor <> 'aaaaaaaa-0000-0000-0000-000000000001'
    or v_amount <> 2 then
    raise exception 'FAIL: expected the forgiveness entry to swap direction (bob owes alice 2), got debtor=% creditor=% amount=%', v_debtor, v_creditor, v_amount;
  end if;
  raise notice 'PASS: forgiving an obligation posts a swapped-direction forgiveness entry with its note';
end;
$$;

-- Net balance now nets 6 remaining minus 2 forgiven = 4.
do $$
declare
  v_net numeric;
begin
  select net_amount into v_net from public.get_my_balances()
  where counterparty_id = 'aaaaaaaa-0000-0000-0000-000000000001' and currency_id = current_setting('test.meal_id')::uuid;
  if v_net <> 4 then
    raise exception 'FAIL: expected bob to be owed 4 after the forgiveness, got %', v_net;
  end if;
  raise notice 'PASS: a forgiveness event correctly reduces the net balance';
end;
$$;

-- Forgiving more than what's left (5 > 4 remaining) is rejected.
do $$
begin
  begin
    perform public.forgive_obligation(jsonb_build_array(
      jsonb_build_object('source_entry_id', current_setting('test.source_id')::text, 'amount', 5)
    ), null);
    raise exception 'FAIL: expected forgiving more than what remains outstanding to be rejected';
  exception
    when others then
      if sqlerrm not like '%exceeds the outstanding balance%' then
        raise;
      end if;
      raise notice 'PASS: cannot forgive more than what remains outstanding';
  end;
end;
$$;

-- Direct table writes are all denied -- RPC only.
do $$
begin
  begin
    insert into public.redemption_requests (debtor_id, creditor_id, currency_id, amount)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', current_setting('test.meal_id')::uuid, 1);
    raise exception 'FAIL: expected direct insert into redemption_requests to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into redemption_requests denied, must use the RPC';
  end;
end;
$$;

do $$
begin
  begin
    insert into public.forgiveness_events (creditor_id, debtor_id, currency_id, amount)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', current_setting('test.meal_id')::uuid, 1);
    raise exception 'FAIL: expected direct insert into forgiveness_events to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into forgiveness_events denied, must use the RPC';
  end;
end;
$$;

do $$
begin
  begin
    insert into public.obligation_allocations (source_entry_id, forgiveness_event_id, amount)
    values (current_setting('test.source_id')::uuid, current_setting('test.forgiveness_id')::uuid, 1);
    raise exception 'FAIL: expected direct insert into obligation_allocations to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into obligation_allocations denied, must use the RPC';
  end;
end;
$$;

-- Carol (uninvolved) cannot see any of this.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.redemption_requests
  where debtor_id = 'aaaaaaaa-0000-0000-0000-000000000001' or creditor_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 redemption requests, saw %', v_count;
  end if;

  select count(*) into v_count from public.forgiveness_events
  where debtor_id = 'aaaaaaaa-0000-0000-0000-000000000001' or creditor_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 forgiveness events, saw %', v_count;
  end if;

  select count(*) into v_count from public.obligation_allocations
  where source_entry_id = current_setting('test.source_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 obligation allocations, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user has no visibility into redemption/forgiveness activity';
end;
$$;

-- anon has no table-level access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.redemption_requests limit 1;
    raise exception 'FAIL: expected anon SELECT on redemption_requests to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to redemption_requests';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.forgiveness_events limit 1;
    raise exception 'FAIL: expected anon SELECT on forgiveness_events to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to forgiveness_events';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'redemption_forgiveness.test.sql: all assertions passed';
end;
$$;
