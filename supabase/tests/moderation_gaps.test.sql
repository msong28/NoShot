-- Behaviour test for the Milestone 13 (MOD-03/04) moderation gap-fixes:
-- poll options and group names now run through moderate_text(), same as
-- currencies/bets/comments/chat/proof already did. Same convention as the
-- other behaviour tests: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'); -- bob

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
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- A group with a blocked-tier name is rejected.
do $$
begin
  begin
    perform public.create_group('Let''s kill it tonight');
    raise exception 'FAIL: expected a blocked-tier group name to be rejected';
  exception
    when others then
      if sqlerrm not like '%that name isn''t allowed%' then raise; end if;
      raise notice 'PASS: a blocked-tier group name is rejected';
  end;
end;
$$;

-- A clean group name still works.
do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.create_group('Test Roommates');
  perform set_config('test.group_id', v_group_id::text, false);
  raise notice 'PASS: a clean group name is accepted';
end;
$$;

do $$
declare
  v_bet_id uuid;
  v_meal_id uuid;
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

-- A poll with a blocked-tier option label is rejected, and no partial poll
-- (question row with zero/partial options) is left behind.
do $$
declare
  v_poll_count integer;
begin
  begin
    perform public.create_poll(
      current_setting('test.bet_id')::uuid, null, 'Who does the dishes?',
      array['Alice', 'Bob, or we kill the loser'], false
    );
    raise exception 'FAIL: expected a blocked-tier poll option to be rejected';
  exception
    when others then
      if sqlerrm not like '%that option isn''t allowed%' then raise; end if;
      raise notice 'PASS: a blocked-tier poll option is rejected';
  end;

  select count(*) into v_poll_count from public.polls where bet_id = current_setting('test.bet_id')::uuid;
  if v_poll_count <> 0 then
    raise exception 'FAIL: expected the rejected poll to leave no row behind, saw %', v_poll_count;
  end if;
  raise notice 'PASS: a rejected poll option leaves no partial poll behind';
end;
$$;

-- A clean poll (question + options) still works.
do $$
declare
  v_poll_id uuid;
  v_option_count integer;
begin
  select id into v_poll_id from public.create_poll(
    current_setting('test.bet_id')::uuid, null, 'Who does the dishes?',
    array['Alice', 'Bob'], false
  );
  select count(*) into v_option_count from public.poll_options where poll_id = v_poll_id;
  if v_option_count <> 2 then
    raise exception 'FAIL: expected 2 clean poll options to be inserted, saw %', v_option_count;
  end if;
  raise notice 'PASS: a clean poll question and options are accepted';
end;
$$;

reset role;

do $$
begin
  raise notice 'moderation_gaps.test.sql: all assertions passed';
end;
$$;
