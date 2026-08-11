-- Behaviour test for bet withdrawal (Phase 1 fixes: creator-initiated
-- "delete bet" before the other side has acted). Same convention as
-- bet_cancellation.test.sql: must ERROR on any failed assertion.
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

-- Alice creates a draft bet, then withdraws it: the row is gone outright.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
  v_status public.bet_status;
  v_count integer;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Dishes tonight', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    ),
    true
  );

  select status into v_status from public.bets where id = v_bet_id;
  if v_status <> 'draft' then
    raise exception 'FAIL: expected a fresh draft bet, got %', v_status;
  end if;

  perform public.withdraw_bet(v_bet_id);

  select count(*) into v_count from public.bets where id = v_bet_id;
  if v_count <> 0 then
    raise exception 'FAIL: expected a withdrawn draft to be deleted outright, found % rows', v_count;
  end if;
  raise notice 'PASS: withdrawing a draft deletes it outright';
end;
$$;

-- Alice proposes a real bet to bob (pending_acceptance).
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Coffee run', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.bet_id', v_bet_id::text, false);
end;
$$;

-- Carol (uninvolved, and not the creator) cannot withdraw it.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.withdraw_bet(current_setting('test.bet_id')::uuid);
    raise exception 'FAIL: expected a non-creator to be rejected';
  exception
    when others then
      if sqlerrm not like '%bet not found%' then raise; end if;
      raise notice 'PASS: a non-creator cannot withdraw someone else''s bet';
  end;
end;
$$;

-- Bob (a participant, but not the creator) cannot withdraw it either.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform public.withdraw_bet(current_setting('test.bet_id')::uuid);
    raise exception 'FAIL: expected a non-creator participant to be rejected';
  exception
    when others then
      if sqlerrm not like '%bet not found%' then raise; end if;
      raise notice 'PASS: a non-creator participant cannot withdraw the bet';
  end;
end;
$$;

-- Alice (the creator) withdraws her pending proposal -- it voids, not deletes.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.withdraw_bet(current_setting('test.bet_id')::uuid);
  if v_status <> 'voided' then
    raise exception 'FAIL: expected the withdrawn proposal to be voided, got %', v_status;
  end if;
  raise notice 'PASS: the creator withdrawing a pending proposal voids it';
end;
$$;

-- Withdrawing an already-voided bet is rejected.
do $$
begin
  begin
    perform public.withdraw_bet(current_setting('test.bet_id')::uuid);
    raise exception 'FAIL: expected withdrawing an already-voided bet to be rejected';
  exception
    when others then
      if sqlerrm not like '%only a draft or not-yet-accepted%' then raise; end if;
      raise notice 'PASS: cannot withdraw a bet that is no longer draft/pending';
  end;
end;
$$;

-- An active bet (both sides already agreed) cannot be withdrawn -- that's
-- propose_cancel_bet/approve_cancel_bet's job instead.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Movie pick', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.active_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.active_bet_id')::uuid, 1, 'approved');
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.withdraw_bet(current_setting('test.active_bet_id')::uuid);
    raise exception 'FAIL: expected withdrawing an active bet to be rejected';
  exception
    when others then
      if sqlerrm not like '%only a draft or not-yet-accepted%' then raise; end if;
      raise notice 'PASS: an active bet cannot be withdrawn, only cancelled';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'bet_withdrawal.test.sql: all assertions passed';
end;
$$;
