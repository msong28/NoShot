-- Proves the exact payloads web/src/lib/wager.ts buildBetInput() produces are
-- accepted by create_or_counter_bet -- the "Path B" convergence, where the new
-- create screen writes into the existing bet engine instead of a separate
-- wagers table. Mirrors buildBetInput's output for the three shapes (even,
-- odds, line) and stakes in the new built-in Money currency.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice (creator)
  ('bbbbbbbb-0000-0000-0000-000000000002'); -- bob (rival)

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice', 'Alice', 2000, now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob', 'Bob', 1998, now());

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- The built-in Money currency exists, is builtin, and is approved -- so a
-- money stake can flow through the engine's builtin-or-owned currency check.
do $$
declare
  v_ok boolean;
begin
  select is_builtin and moderation_status = 'approved'
  into v_ok
  from public.currencies
  where id = '00000000-0000-4000-8000-000000000001' and name = 'Money';

  if not coalesce(v_ok, false) then
    raise exception 'FAIL: expected an approved built-in Money currency';
  end if;
  raise notice 'PASS: the built-in Money currency is present and approved';
end;
$$;

-- Even money bet (no modifiers): symmetric 5/5 at 1:1 on generic sides.
do $$
declare
  v_money uuid := '00000000-0000-4000-8000-000000000001';
  v_bet_id uuid;
  v_status public.bet_status;
  v_alice numeric;
  v_bob numeric;
begin
  select id, status into v_bet_id, v_status from public.create_or_counter_bet(
    null, null, 'Lakers win', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"creator","label":"You"},{"outcome_key":"rival","label":"Bob"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'creator', 'currency_id', v_money, 'stake_quantity', 5, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'rival', 'currency_id', v_money, 'stake_quantity', 5, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );

  if v_status <> 'pending_acceptance' then
    raise exception 'FAIL: expected a fresh bet to be pending_acceptance, got %', v_status;
  end if;

  select bc.stake_quantity into v_alice from public.bet_commitments bc
    join public.bet_participants bp on bp.id = bc.participant_id
    where bc.bet_id = v_bet_id and bp.user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select bc.stake_quantity into v_bob from public.bet_commitments bc
    join public.bet_participants bp on bp.id = bc.participant_id
    where bc.bet_id = v_bet_id and bp.user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_alice <> 5 or v_bob <> 5 then
    raise exception 'FAIL: expected symmetric 5/5 stakes, got % / %', v_alice, v_bob;
  end if;
  raise notice 'PASS: an even money bet maps to symmetric 5/5 stakes and lands pending';
end;
$$;

-- 3:1 odds favoring the creator: creator stakes 15 at 3:1 (payout 5), rival
-- stakes 5 at 1:3 (payout 15). Funding (BET-05) must hold, so the bet is
-- created rather than rejected.
do $$
declare
  v_money uuid := '00000000-0000-4000-8000-000000000001';
  v_bet_id uuid;
  v_alice_stake numeric;
  v_alice_payout numeric;
  v_bob_stake numeric;
  v_bob_payout numeric;
begin
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Lakers by a lot', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"creator","label":"You"},{"outcome_key":"rival","label":"Bob"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'creator', 'currency_id', v_money, 'stake_quantity', 15, 'odds_numerator', 3, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'rival', 'currency_id', v_money, 'stake_quantity', 5, 'odds_numerator', 1, 'odds_denominator', 3)
    )
  );

  select bc.stake_quantity, bc.payout_if_win into v_alice_stake, v_alice_payout
    from public.bet_commitments bc join public.bet_participants bp on bp.id = bc.participant_id
    where bc.bet_id = v_bet_id and bp.user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select bc.stake_quantity, bc.payout_if_win into v_bob_stake, v_bob_payout
    from public.bet_commitments bc join public.bet_participants bp on bp.id = bc.participant_id
    where bc.bet_id = v_bet_id and bp.user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_alice_stake <> 15 or v_alice_payout <> 5 then
    raise exception 'FAIL: expected favored creator to stake 15 to win 5, got stake % payout %', v_alice_stake, v_alice_payout;
  end if;
  if v_bob_stake <> 5 or v_bob_payout <> 15 then
    raise exception 'FAIL: expected rival to stake 5 to win 15, got stake % payout %', v_bob_stake, v_bob_payout;
  end if;
  raise notice 'PASS: 3:1 odds favoring the creator maps to funded 15/5 stakes';
end;
$$;

-- A line becomes over/under sides, creator on their chosen position (under).
do $$
declare
  v_money uuid := '00000000-0000-4000-8000-000000000001';
  v_bet_id uuid;
  v_alice_outcome text;
  v_side_count integer;
begin
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Total points', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"over","label":"Over 56.5"},{"outcome_key":"under","label":"Under 56.5"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'under', 'currency_id', v_money, 'stake_quantity', 5, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'over', 'currency_id', v_money, 'stake_quantity', 5, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );

  select count(*) into v_side_count from public.bet_sides where bet_id = v_bet_id and version_no = 1;
  select bs.outcome_key into v_alice_outcome
    from public.bet_participants bp join public.bet_sides bs on bs.id = bp.side_id
    where bp.bet_id = v_bet_id and bp.user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  if v_side_count <> 2 or v_alice_outcome <> 'under' then
    raise exception 'FAIL: expected 2 over/under sides with the creator on under, got % sides, creator on %', v_side_count, v_alice_outcome;
  end if;
  raise notice 'PASS: a line maps to over/under sides with the creator on their position';
end;
$$;

reset role;

do $$
begin
  raise notice 'wager_create_mapping.test.sql: all assertions passed';
end;
$$;
