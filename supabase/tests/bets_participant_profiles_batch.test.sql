-- Behaviour test for get_bets_participant_profiles (Home/Bets-tab list
-- enrichment: opponent name across many bets in one round trip). Same
-- convention as the other behaviour tests: must ERROR on any failed
-- assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'); -- carol (unrelated)

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

-- Alice creates two bets against Bob.
do $$
declare
  v_meal_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  perform public.create_or_counter_bet(
    null, null, 'Dishes tonight', 'Loser does dishes', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform public.create_or_counter_bet(
    null, null, 'Coffee run', 'Loser buys coffee', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
end $$;

-- Alice can fetch both bets' rosters in one batched call.
do $$
declare
  v_bet_ids uuid[];
  v_row_count integer;
  v_distinct_bets integer;
begin
  select array_agg(id) into v_bet_ids from public.bets where title in ('Dishes tonight', 'Coffee run');

  select count(*) into v_row_count from public.get_bets_participant_profiles(v_bet_ids);
  if v_row_count <> 4 then
    raise exception 'FAIL: expected 4 participant rows (2 bets x 2 participants), got %', v_row_count;
  end if;

  select count(distinct bet_id) into v_distinct_bets from public.get_bets_participant_profiles(v_bet_ids);
  if v_distinct_bets <> 2 then
    raise exception 'FAIL: expected rows spanning 2 distinct bets, got %', v_distinct_bets;
  end if;

  raise notice 'PASS: alice sees both participants for both of her bets in one call';
end $$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

-- Carol is not a participant on either bet and shares no group -- sees nothing.
do $$
declare
  v_bet_ids uuid[];
  v_row_count integer;
begin
  select array_agg(id) into v_bet_ids from public.bets where title in ('Dishes tonight', 'Coffee run');

  select count(*) into v_row_count from public.get_bets_participant_profiles(v_bet_ids);
  if v_row_count <> 0 then
    raise exception 'FAIL: expected carol (uninvolved) to see 0 rows, got %', v_row_count;
  end if;
  raise notice 'PASS: an uninvolved caller sees no participant rows for bets they are not part of';
end $$;

reset role;

-- anon has no execute privilege on the function at all.
set role anon;

do $$
begin
  perform public.get_bets_participant_profiles(array[]::uuid[]);
  raise exception 'FAIL: expected anon to be denied execute on get_bets_participant_profiles';
exception
  when insufficient_privilege then
    raise notice 'PASS: anon has no execute privilege on get_bets_participant_profiles';
end $$;

reset role;

do $$
begin
  raise notice 'bets_participant_profiles_batch.test.sql: all assertions passed';
end $$;
