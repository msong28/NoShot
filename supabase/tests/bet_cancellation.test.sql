-- Behaviour test for bet cancellation (Milestone 7). Same convention as
-- bets_core.test.sql: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'); -- carol

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

-- Set up an active bet between alice and bob, exactly like bets_core does.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Dishes tonight', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.bet_id')::uuid, 1, 'approved');
end;
$$;

-- Carol (uninvolved) cannot propose cancelling a bet she's not part of.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.propose_cancel_bet(current_setting('test.bet_id')::uuid, null);
    raise exception 'FAIL: expected an uninvolved user to be rejected';
  exception
    when others then
      if sqlerrm not like '%only a participant%' then raise; end if;
      raise notice 'PASS: an uninvolved user cannot propose cancelling a bet';
  end;
end;
$$;

-- Alice proposes cancellation; the bet goes to cancellation_pending.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.propose_cancel_bet(current_setting('test.bet_id')::uuid, 'change of plans');
  if v_status <> 'cancellation_pending' then
    raise exception 'FAIL: expected cancellation_pending, got %', v_status;
  end if;
  raise notice 'PASS: alice proposed cancelling the bet';
end;
$$;

-- Direct table insert must be denied -- only the functions may write.
do $$
begin
  begin
    insert into public.bet_cancellation_approvals (bet_id, user_id, decision)
    values (current_setting('test.bet_id')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'approved');
    raise exception 'FAIL: expected direct insert into bet_cancellation_approvals to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into bet_cancellation_approvals denied, must use the RPC';
  end;
end;
$$;

-- A fresh cancellation proposal against an already-pending one is rejected
-- (only an active bet can have cancellation proposed).
do $$
begin
  begin
    perform public.propose_cancel_bet(current_setting('test.bet_id')::uuid, null);
    raise exception 'FAIL: expected a second cancellation proposal to be rejected';
  exception
    when others then
      if sqlerrm not like '%only an active bet%' then raise; end if;
      raise notice 'PASS: cannot propose cancellation while one is already pending';
  end;
end;
$$;

-- Carol still can't see the cancellation approval rows.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.bet_cancellation_approvals
  where bet_id = current_setting('test.bet_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 cancellation rows, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see cancellation approvals';
end;
$$;

-- Bob declines the cancellation; the bet reverts to active.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.bet_status;
  v_count integer;
begin
  select status into v_status from public.approve_cancel_bet(current_setting('test.bet_id')::uuid, 'declined');
  if v_status <> 'active' then
    raise exception 'FAIL: expected the bet to revert to active, got %', v_status;
  end if;

  select count(*) into v_count from public.bet_cancellation_approvals
  where bet_id = current_setting('test.bet_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected the failed attempt''s rows to be cleared, found %', v_count;
  end if;
  raise notice 'PASS: declining a cancellation reverts the bet to active and clears the attempt';
end;
$$;

-- Approving a cancellation that no longer exists is rejected.
do $$
begin
  begin
    perform public.approve_cancel_bet(current_setting('test.bet_id')::uuid, 'approved');
    raise exception 'FAIL: expected approving with no cancellation in progress to be rejected';
  exception
    when others then
      if sqlerrm not like '%no cancellation in progress%' then raise; end if;
      raise notice 'PASS: cannot respond to a cancellation that is not in progress';
  end;
end;
$$;

-- Alice proposes again (a fresh attempt); Bob approves this time; the bet voids.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform public.propose_cancel_bet(current_setting('test.bet_id')::uuid, null);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.approve_cancel_bet(current_setting('test.bet_id')::uuid, 'approved');
  if v_status <> 'voided' then
    raise exception 'FAIL: expected unanimous cancellation approval to void the bet, got %', v_status;
  end if;
  raise notice 'PASS: unanimous cancellation approval voids the bet';
end;
$$;

-- Bob cannot respond to the same cancellation round twice.
do $$
begin
  begin
    perform public.approve_cancel_bet(current_setting('test.bet_id')::uuid, 'approved');
    raise exception 'FAIL: expected approving twice to be rejected';
  exception
    when others then
      if sqlerrm not like '%no cancellation in progress%' then raise; end if;
      raise notice 'PASS: once voided, there is no cancellation left to respond to';
  end;
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.bet_cancellation_approvals limit 1;
    raise exception 'FAIL: expected anon SELECT on bet_cancellation_approvals to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to bet_cancellation_approvals';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'bet_cancellation.test.sql: all assertions passed';
end;
$$;
