-- Behaviour test for the from-scratch wagers schema. Same convention as
-- bets_core.test.sql: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'); -- carol (uninvolved, not a friend)

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

-- Setup runs before `set role authenticated`, so this direct insert bypasses
-- RLS the same way profiles' does above -- accepted friendship is the only
-- precondition create_wager() needs from the friend system.
insert into
  public.friendships (requester_id, addressee_id, status)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'accepted'
  );

insert into
  public.currencies (name, category, owner_user_id, moderation_status)
values
  (
    'Bob''s Thing',
    'custom',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'approved'
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Cannot wager against someone who isn't a friend.
do $$
begin
  begin
    perform public.create_wager(
      'Race you there', '', 'cccccccc-0000-0000-0000-000000000003', 5, 'money', null,
      null, null, null, null, null, null
    );
    raise exception 'FAIL: expected a wager against a non-friend to be rejected';
  exception
    when others then
      if sqlerrm not like '%only wager against a friend%' then raise; end if;
      raise notice 'PASS: cannot wager against someone who is not a friend';
  end;
end;
$$;

-- Cannot wager against yourself.
do $$
begin
  begin
    perform public.create_wager(
      'Race myself', '', 'aaaaaaaa-0000-0000-0000-000000000001', 5, 'money', null,
      null, null, null, null, null, null
    );
    raise exception 'FAIL: expected a self-wager to be rejected';
  exception
    when others then
      if sqlerrm not like '%cannot wager against yourself%' then raise; end if;
      raise notice 'PASS: cannot wager against yourself';
  end;
end;
$$;

-- Blocked content is rejected server-side, not just client-advisory.
do $$
begin
  begin
    perform public.create_wager(
      'I will kill you if you win', '', 'bbbbbbbb-0000-0000-0000-000000000002', 5, 'money', null,
      null, null, null, null, null, null
    );
    raise exception 'FAIL: expected blocked content to be rejected';
  exception
    when others then
      if sqlerrm not like '%text isn''t allowed%' then raise; end if;
      raise notice 'PASS: a blocked event description is rejected server-side';
  end;
end;
$$;

-- A custom currency the caller doesn't own (and isn't builtin) is rejected.
do $$
declare
  v_bob_currency_id uuid;
begin
  select id into v_bob_currency_id from public.currencies where name = 'Bob''s Thing';

  begin
    perform public.create_wager(
      'Borrow a currency', '', 'bbbbbbbb-0000-0000-0000-000000000002', 5, 'custom', v_bob_currency_id,
      null, null, null, null, null, null
    );
    raise exception 'FAIL: expected an unowned custom currency to be rejected';
  exception
    when others then
      if sqlerrm not like '%not available to you%' then raise; end if;
      raise notice 'PASS: a custom currency the caller does not own is rejected';
  end;
end;
$$;

-- The simplest case: no modifiers at all, symmetric stakes, a builtin currency.
do $$
declare
  v_chore_id uuid;
  v_wager_id uuid;
  v_status public.wager_status;
  v_alice_amount numeric;
  v_bob_amount numeric;
begin
  select id into v_chore_id from public.currencies where name = 'Chore';

  select id, status into v_wager_id, v_status from public.create_wager(
    'Who does the dishes this week?', 'Loser does dishes', 'bbbbbbbb-0000-0000-0000-000000000002', 5, 'custom', v_chore_id,
    null, null, null, null, null, null
  );
  perform set_config('test.plain_wager_id', v_wager_id::text, false);

  if v_status <> 'pending' then
    raise exception 'FAIL: expected a fresh wager to be pending, got %', v_status;
  end if;

  select amount into v_alice_amount from public.wager_stakes
  where wager_id = v_wager_id and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select amount into v_bob_amount from public.wager_stakes
  where wager_id = v_wager_id and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_alice_amount <> 5 or v_bob_amount <> 5 then
    raise exception 'FAIL: expected symmetric 5/5 stakes with no odds, got % / %', v_alice_amount, v_bob_amount;
  end if;
  raise notice 'PASS: a wager with every modifier off has symmetric stakes and lands pending';
end;
$$;

-- Odds modifier: base stake 5, ratio 3:1 favoring alice -> alice risks 15,
-- bob risks 5 (the worked example from the plan: the favored side risks
-- numerator x base, the other risks denominator x base).
do $$
declare
  v_wager_id uuid;
  v_alice_amount numeric;
  v_bob_amount numeric;
begin
  select id into v_wager_id from public.create_wager(
    'Lakers vs Celtics', '', 'bbbbbbbb-0000-0000-0000-000000000002', 5, 'money', null,
    null, 3, 1, 'aaaaaaaa-0000-0000-0000-000000000001', null, null
  );

  select amount into v_alice_amount from public.wager_stakes
  where wager_id = v_wager_id and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select amount into v_bob_amount from public.wager_stakes
  where wager_id = v_wager_id and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_alice_amount <> 15 or v_bob_amount <> 5 then
    raise exception 'FAIL: expected 15/5 for a 3:1 favoring alice on a base stake of 5, got % / %', v_alice_amount, v_bob_amount;
  end if;
  raise notice 'PASS: odds scales the favored side''s stake by the ratio';
end;
$$;

-- Line modifier: only the creator's position is stored.
do $$
declare
  v_wager_id uuid;
  v_line_value numeric;
  v_position text;
begin
  select id into v_wager_id from public.create_wager(
    'Total points scored', '', 'bbbbbbbb-0000-0000-0000-000000000002', 5, 'money', null,
    null, null, null, null, 56.5, 'over'
  );

  select line_value, line_creator_position into v_line_value, v_position
  from public.wagers where id = v_wager_id;

  if v_line_value <> 56.5 or v_position <> 'over' then
    raise exception 'FAIL: expected line 56.5/over, got % / %', v_line_value, v_position;
  end if;
  raise notice 'PASS: the line modifier stores the creator''s position';
end;
$$;

-- Direct table inserts are denied -- only create_wager() may write.
do $$
begin
  begin
    insert into public.wagers (creator_id, rival_id, event, currency_kind)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Sneaky wager', 'money');
    raise exception 'FAIL: expected direct insert into wagers to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into wagers denied, must use the RPC';
  end;
end;
$$;

-- Bob (the rival) can see the plain wager; Carol (uninvolved) cannot.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.wagers where id = current_setting('test.plain_wager_id')::uuid;
  if v_count <> 1 then
    raise exception 'FAIL: expected the rival to see the wager, saw %', v_count;
  end if;
  raise notice 'PASS: the rival can see a wager they are party to';
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_wagers integer;
  v_stakes integer;
begin
  select count(*) into v_wagers from public.wagers where id = current_setting('test.plain_wager_id')::uuid;
  select count(*) into v_stakes from public.wager_stakes where wager_id = current_setting('test.plain_wager_id')::uuid;
  if v_wagers <> 0 or v_stakes <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see nothing, saw % wagers / % stakes', v_wagers, v_stakes;
  end if;
  raise notice 'PASS: an uninvolved user cannot see the wager or its stakes';
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.wagers limit 1;
    raise exception 'FAIL: expected anon SELECT on wagers to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to wagers';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'wagers.test.sql: all assertions passed';
end;
$$;
