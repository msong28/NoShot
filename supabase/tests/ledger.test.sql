-- Behaviour test for the ledger (Milestone 9). Same convention as
-- bet_resolution.test.sql: must ERROR on any failed assertion.
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

-- Reproduce the PRD's exact §5.3 worked example: alice risks 1 at 1:2,
-- bob risks 2 at 2:1. If alice wins, she's owed 2; bob owes 2.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

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
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 2),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 2, 'odds_numerator', 2, 'odds_denominator', 1)
    )
  );
  perform set_config('test.bet_id', v_bet_id::text, false);
  perform set_config('test.meal_id', v_meal_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.bet_id')::uuid, 'alice_wins', null);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_debtor uuid;
  v_creditor uuid;
  v_amount numeric;
  v_count integer;
begin
  select count(*) into v_count from public.ledger_entries where source_id = current_setting('test.bet_id')::uuid;
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 ledger entry for a 1-vs-1 resolved bet, got %', v_count;
  end if;

  select debtor_id, creditor_id, amount into v_debtor, v_creditor, v_amount
  from public.ledger_entries where source_id = current_setting('test.bet_id')::uuid;

  if v_debtor <> 'bbbbbbbb-0000-0000-0000-000000000002'
    or v_creditor <> 'aaaaaaaa-0000-0000-0000-000000000001'
    or v_amount <> 2 then
    raise exception 'FAIL: expected bob owes alice 2, got debtor=% creditor=% amount=%', v_debtor, v_creditor, v_amount;
  end if;
  raise notice 'PASS: a resolved bet posts exactly the ledger entry the PRD''s worked example expects';
end;
$$;

-- Direct table insert must be denied -- only the functions may write.
do $$
begin
  begin
    insert into public.ledger_entries (debtor_id, creditor_id, currency_id, amount, entry_type, source_type, source_id)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', current_setting('test.meal_id')::uuid, 5, 'correction', 'bet', current_setting('test.bet_id')::uuid);
    raise exception 'FAIL: expected direct insert into ledger_entries to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into ledger_entries denied, must use the RPC';
  end;
end;
$$;

-- The ledger is append-only -- no client role can update or delete it.
do $$
begin
  begin
    update public.ledger_entries set amount = 999 where source_id = current_setting('test.bet_id')::uuid;
    raise exception 'FAIL: expected updating a ledger entry to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: ledger entries cannot be updated';
  end;
end;
$$;

do $$
begin
  begin
    delete from public.ledger_entries where source_id = current_setting('test.bet_id')::uuid;
    raise exception 'FAIL: expected deleting a ledger entry to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: ledger entries cannot be deleted';
  end;
end;
$$;

-- Balances: alice is owed 2, bob owes 2, for the same pair/currency.
do $$
declare
  v_net numeric;
begin
  select net_amount into v_net from public.get_my_balances()
  where counterparty_id = 'bbbbbbbb-0000-0000-0000-000000000002' and currency_id = current_setting('test.meal_id')::uuid;
  if v_net <> 2 then
    raise exception 'FAIL: expected alice to be owed 2, got %', v_net;
  end if;
  raise notice 'PASS: get_my_balances shows alice is owed 2 from bob';
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_net numeric;
begin
  select net_amount into v_net from public.get_my_balances()
  where counterparty_id = 'aaaaaaaa-0000-0000-0000-000000000001' and currency_id = current_setting('test.meal_id')::uuid;
  if v_net <> -2 then
    raise exception 'FAIL: expected bob to owe 2 (net -2), got %', v_net;
  end if;
  raise notice 'PASS: get_my_balances shows bob owes alice 2';
end;
$$;

-- Carol (uninvolved) cannot see this ledger entry at all.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.ledger_entries where source_id = current_setting('test.bet_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 ledger entries, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see a ledger entry they are not party to';
end;
$$;

-- A tied bet posts no ledger entries at all (RES-06).
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
  v_submission_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Tie bet', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.tie_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.tie_bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.tie_bet_id')::uuid, 'tie', null);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.ledger_entries where source_id = current_setting('test.tie_bet_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected a tied bet to post 0 ledger entries, got %', v_count;
  end if;
  raise notice 'PASS: a tied bet posts no ledger entries';
end;
$$;

-- An approved manual obligation posts a ledger entry too (Milestone 10's
-- deferred write, now wired in).
do $$
declare
  v_meal_id uuid;
  v_proposal_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_proposal_id from public.propose_manual_obligation(
    'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', v_meal_id, 3, 'Gas money'
  );
  perform set_config('test.manual_obligation_id', v_proposal_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
  v_debtor uuid;
  v_creditor uuid;
  v_amount numeric;
begin
  perform public.approve_manual_obligation(current_setting('test.manual_obligation_id')::uuid);

  select count(*) into v_count from public.ledger_entries where source_id = current_setting('test.manual_obligation_id')::uuid;
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 ledger entry for the approved manual obligation, got %', v_count;
  end if;

  select debtor_id, creditor_id, amount into v_debtor, v_creditor, v_amount
  from public.ledger_entries where source_id = current_setting('test.manual_obligation_id')::uuid;
  if v_debtor <> 'aaaaaaaa-0000-0000-0000-000000000001' or v_creditor <> 'bbbbbbbb-0000-0000-0000-000000000002' or v_amount <> 3 then
    raise exception 'FAIL: expected alice owes bob 3, got debtor=% creditor=% amount=%', v_debtor, v_creditor, v_amount;
  end if;
  raise notice 'PASS: an approved manual obligation posts the right ledger entry';
end;
$$;

-- Alice's net balance with bob now nets the bet settlement (+2) against the
-- manual obligation (-3): she's owed 2 but owes 3, net -1.
do $$
declare
  v_net numeric;
begin
  select net_amount into v_net from public.get_my_balances()
  where counterparty_id = 'bbbbbbbb-0000-0000-0000-000000000002' and currency_id = current_setting('test.meal_id')::uuid;
  if v_net <> -1 then
    raise exception 'FAIL: expected alice''s net with bob to be -1 (owed 2, owes 3), got %', v_net;
  end if;
  raise notice 'PASS: get_my_balances nets multiple ledger entries for the same pair/currency correctly';
end;
$$;

-- A bet doesn't require friendship, so a ledger counterparty isn't always a
-- friend -- get_ledger_counterparty_profiles must resolve carol's name for
-- alice based on their ledger relationship alone, not a friendships row
-- (which doesn't exist between them).
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Alice vs Carol', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"carol_wins","label":"Carol wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'cccccccc-0000-0000-0000-000000000003', 'outcome_key', 'carol_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.no_friend_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  perform public.approve_bet_version(current_setting('test.no_friend_bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.no_friend_bet_id')::uuid, 'alice_wins', null);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_display_name text;
begin
  select display_name into v_display_name
  from public.get_ledger_counterparty_profiles (array['cccccccc-0000-0000-0000-000000000003'::uuid])
  where id = 'cccccccc-0000-0000-0000-000000000003';
  if v_display_name is distinct from 'Carol' then
    raise exception 'FAIL: expected to resolve carol''s name via the ledger relationship, got %', v_display_name;
  end if;
  raise notice 'PASS: get_ledger_counterparty_profiles resolves a non-friend bet counterparty';
end;
$$;

-- A bet's currency only has to be visible to its creator, not every
-- participant -- bob bets alice using a currency he personally owns, and
-- alice must still be able to resolve its name via the ledger relationship
-- even though currencies' own RLS would otherwise hide it from her.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_bob_currency_id uuid;
  v_bet_id uuid;
begin
  insert into public.currencies (name, category, owner_user_id)
  values ('Bob''s Coupons', 'custom', 'bbbbbbbb-0000-0000-0000-000000000002')
  returning id into v_bob_currency_id;
  perform set_config('test.bob_currency_id', v_bob_currency_id::text, false);

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Bob''s currency bet', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_bob_currency_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_bob_currency_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.bob_currency_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform public.approve_bet_version(current_setting('test.bob_currency_bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.bob_currency_bet_id')::uuid, 'bob_wins', null);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_direct_count integer;
  v_resolved_name text;
begin
  select count(*) into v_direct_count from public.currencies where id = current_setting('test.bob_currency_id')::uuid;
  if v_direct_count <> 0 then
    raise exception 'FAIL: expected alice to NOT see bob''s personal currency directly, saw %', v_direct_count;
  end if;

  select name into v_resolved_name
  from public.get_ledger_currency_names (array[current_setting('test.bob_currency_id')::uuid])
  where id = current_setting('test.bob_currency_id')::uuid;
  if v_resolved_name is distinct from 'Bob''s Coupons' then
    raise exception 'FAIL: expected to resolve bob''s currency name via the ledger relationship, got %', v_resolved_name;
  end if;
  raise notice 'PASS: get_ledger_currency_names resolves a currency invisible via direct RLS';
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.ledger_entries limit 1;
    raise exception 'FAIL: expected anon SELECT on ledger_entries to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to ledger_entries';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'ledger.test.sql: all assertions passed';
end;
$$;
