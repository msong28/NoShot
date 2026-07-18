-- Behaviour test for the bet engine core (Milestone 6). Same convention as
-- groups_membership.test.sql: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'), -- carol
  ('dddddddd-0000-0000-0000-000000000004'); -- dave

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
  ),
  (
    'dddddddd-0000-0000-0000-000000000004',
    'dave',
    'Dave',
    1996,
    now()
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- The creator must be a participant.
do $$
declare
  v_meal_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  begin
    perform public.create_or_counter_bet(
      null, null, 'Dishes tonight', 'Loser does dishes', null, 'participant_submission', null, false,
      '[{"outcome_key":"bob_wins","label":"Bob wins"},{"outcome_key":"dave_wins","label":"Dave wins"}]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
        jsonb_build_object('user_id', 'dddddddd-0000-0000-0000-000000000004', 'outcome_key', 'dave_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
      )
    );
    raise exception 'FAIL: expected a bet with no creator participant to be rejected';
  exception
    when others then
      if sqlerrm not like '%creator must be a participant%' then raise; end if;
      raise notice 'PASS: the creator must be one of the participants';
  end;
end;
$$;

-- Payout matching the PRD §5.3 example: Alice risks 1 meal at 1:2 against
-- Bob, who risks 2 meals at 2:1. Alice's proposal implicitly approves it.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
  v_status public.bet_status;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select id, status into v_bet_id, v_status from public.create_or_counter_bet(
    null, null, 'Dishes tonight', 'Loser does dishes', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 2),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 2, 'odds_numerator', 2, 'odds_denominator', 1)
    )
  );
  perform set_config('test.bet_id', v_bet_id::text, false);

  if v_status <> 'pending_acceptance' then
    raise exception 'FAIL: expected a fresh proposal to be pending_acceptance, got %', v_status;
  end if;
  raise notice 'PASS: alice proposed a direct bet against bob';
end;
$$;

-- Direct table insert must be denied -- only the functions may write.
do $$
begin
  begin
    insert into public.bets (creator_id, title)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Sneaky Bet');
    raise exception 'FAIL: expected direct insert into bets to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into bets denied, must use the RPC';
  end;
end;
$$;

-- The payout preview matches the hand-worked PRD example exactly: if alice
-- wins she's owed 2 meals, bob owes 2; if bob wins he's owed 1, alice owes 1.
do $$
declare
  v_alice_if_alice_wins numeric;
  v_bob_if_alice_wins numeric;
begin
  select amount into v_alice_if_alice_wins from public.get_bet_payout_preview(current_setting('test.bet_id')::uuid, 1)
  where outcome_key = 'alice_wins' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select amount into v_bob_if_alice_wins from public.get_bet_payout_preview(current_setting('test.bet_id')::uuid, 1)
  where outcome_key = 'alice_wins' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_alice_if_alice_wins <> 2 or v_bob_if_alice_wins <> -2 then
    raise exception 'FAIL: expected +2/-2 if alice wins, got % / %', v_alice_if_alice_wins, v_bob_if_alice_wins;
  end if;
  raise notice 'PASS: payout preview matches the PRD''s worked example';
end;
$$;

-- Carol (uninvolved, not even in a shared group) sees nothing about this bet.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_bets integer;
  v_commitments integer;
begin
  select count(*) into v_bets from public.bets where id = current_setting('test.bet_id')::uuid;
  select count(*) into v_commitments from public.bet_commitments where bet_id = current_setting('test.bet_id')::uuid;
  if v_bets <> 0 or v_commitments <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see nothing, saw % bets / % commitments', v_bets, v_commitments;
  end if;
  raise notice 'PASS: an uninvolved user cannot see the bet or its commitments';
end;
$$;

-- Bob approves; unanimous approval activates the bet.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.approve_bet_version(current_setting('test.bet_id')::uuid, 1, 'approved');
  if v_status <> 'active' then
    raise exception 'FAIL: expected the bet to activate on unanimous approval, got %', v_status;
  end if;
  raise notice 'PASS: unanimous approval activates the bet';
end;
$$;

-- Bob cannot approve the same version twice.
do $$
begin
  begin
    perform public.approve_bet_version(current_setting('test.bet_id')::uuid, 1, 'approved');
    raise exception 'FAIL: expected a duplicate approval to be rejected';
  exception
    when others then
      if sqlerrm not like '%already responded%' then raise; end if;
      raise notice 'PASS: cannot approve the same version twice';
  end;
end;
$$;

-- Bob proposes an amendment now that the bet is active; it goes back to
-- pending_acceptance on a new version, and only bob (the proposer) has
-- approved it so far -- alice's original approval doesn't carry over.
do $$
declare
  v_meal_id uuid;
  v_status public.bet_status;
  v_version integer;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select status, current_version into v_status, v_version from public.propose_bet_amendment(
    current_setting('test.bet_id')::uuid, 'Dishes tonight (extra spicy)', 'Loser does dishes AND takes out trash', null,
    'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 2),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 2, 'odds_numerator', 2, 'odds_denominator', 1)
    )
  );

  if v_status <> 'pending_acceptance' or v_version <> 2 then
    raise exception 'FAIL: expected an amendment to bump to v2 and go back to pending_acceptance, got % / %', v_status, v_version;
  end if;
  raise notice 'PASS: amending an active bet creates a new version and resets approval';
end;
$$;

-- Approving the now-stale version 1 is rejected.
do $$
begin
  begin
    perform public.approve_bet_version(current_setting('test.bet_id')::uuid, 1, 'approved');
    raise exception 'FAIL: expected approving a stale version to be rejected';
  exception
    when others then
      if sqlerrm not like '%newer version exists%' then raise; end if;
      raise notice 'PASS: approving a stale version is rejected';
  end;
end;
$$;

-- Alice approves v2; unanimous again, bet re-activates.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.approve_bet_version(current_setting('test.bet_id')::uuid, 2, 'approved');
  if v_status <> 'active' then
    raise exception 'FAIL: expected the amended bet to re-activate, got %', v_status;
  end if;
  raise notice 'PASS: the amended version activates once everyone re-approves';
end;
$$;

-- A fresh proposal with mismatched currencies is rejected.
do $$
declare
  v_meal_id uuid;
  v_coffee_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_coffee_id from public.currencies where name = 'Coffee';

  begin
    perform public.create_or_counter_bet(
      null, null, 'Mismatched currencies', '', null, 'participant_submission', null, false,
      '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"dave_wins","label":"Dave wins"}]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
        jsonb_build_object('user_id', 'dddddddd-0000-0000-0000-000000000004', 'outcome_key', 'dave_wins', 'currency_id', v_coffee_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
      )
    );
    raise exception 'FAIL: expected mismatched currencies to be rejected';
  exception
    when others then
      if sqlerrm not like '%same currency%' then raise; end if;
      raise notice 'PASS: a bet cannot mix currencies across commitments';
  end;
end;
$$;

-- A proposal where a winning payout exceeds the other side's stake is rejected.
do $$
declare
  v_meal_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  begin
    perform public.create_or_counter_bet(
      null, null, 'Underfunded bet', '', null, 'participant_submission', null, false,
      '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"dave_wins","label":"Dave wins"}]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 5),
        jsonb_build_object('user_id', 'dddddddd-0000-0000-0000-000000000004', 'outcome_key', 'dave_wins', 'currency_id', v_meal_id, 'stake_quantity', 2, 'odds_numerator', 1, 'odds_denominator', 1)
      )
    );
    raise exception 'FAIL: expected an underfunded payout to be rejected';
  exception
    when others then
      if sqlerrm not like '%exceeds what everyone else has staked%' then raise; end if;
      raise notice 'PASS: a winning payout that exceeds the other side''s stake is rejected';
  end;
end;
$$;

-- Alice proposes a bet to Dave, who declines outright -- it's voided, no
-- cancellation dance needed since nothing was ever activated.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Race you there', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"dave_wins","label":"Dave wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'dddddddd-0000-0000-0000-000000000004', 'outcome_key', 'dave_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.decline_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.approve_bet_version(current_setting('test.decline_bet_id')::uuid, 1, 'declined');
  if v_status <> 'voided' then
    raise exception 'FAIL: expected an outright decline to void the bet, got %', v_status;
  end if;
  raise notice 'PASS: a participant declining before activation voids the bet';
end;
$$;

-- A group member who isn't a bet participant sees the bet exists (GR-04)
-- but not its commitments.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_id uuid;
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_group_id from public.create_group('Roomies');
  perform public.invite_to_group(v_group_id, 'cccccccc-0000-0000-0000-000000000003');
  perform set_config('test.group_id', v_group_id::text, false);

  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, v_group_id, 'Group chore bet', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.group_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  perform public.respond_to_group_invite(current_setting('test.group_id')::uuid, true);
end;
$$;

do $$
declare
  v_bets integer;
  v_commitments integer;
begin
  select count(*) into v_bets from public.bets where id = current_setting('test.group_bet_id')::uuid;
  select count(*) into v_commitments from public.bet_commitments where bet_id = current_setting('test.group_bet_id')::uuid;
  if v_bets <> 1 then
    raise exception 'FAIL: expected a group member to see the bet exists, saw %', v_bets;
  end if;
  if v_commitments <> 0 then
    raise exception 'FAIL: expected a non-participant group member to see 0 commitments, saw %', v_commitments;
  end if;
  raise notice 'PASS: a group member sees a group bet exists but not its commitments';
end;
$$;

-- get_bet_participant_profiles returns the roster for a participant, and
-- nothing for someone who isn't one (mirrors get_group_member_profiles).
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.get_bet_participant_profiles(current_setting('test.bet_id')::uuid);
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 participant profiles (alice, bob), got %', v_count;
  end if;
  raise notice 'PASS: get_bet_participant_profiles returns the roster for a participant';
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.get_bet_participant_profiles(current_setting('test.bet_id')::uuid);
  if v_count <> 0 then
    raise exception 'FAIL: expected a non-participant to get 0 roster rows, got %', v_count;
  end if;
  raise notice 'PASS: get_bet_participant_profiles returns nothing for a non-participant';
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.bets limit 1;
    raise exception 'FAIL: expected anon SELECT on bets to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to bets';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'bets_core.test.sql: all assertions passed';
end;
$$;
