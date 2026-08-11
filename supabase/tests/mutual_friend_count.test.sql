-- Behaviour test for get_mutual_friend_count (Friends screen "N mutual").
-- Same convention as the other behaviour tests: must ERROR on any failed
-- assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'), -- carol
  ('dddddddd-0000-0000-0000-000000000004'), -- dave
  ('eeeeeeee-0000-0000-0000-000000000005'); -- eve (friendless)

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice', 'Alice', 2000, now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob', 'Bob', 1998, now()),
  ('cccccccc-0000-0000-0000-000000000003', 'carol', 'Carol', 1997, now()),
  ('dddddddd-0000-0000-0000-000000000004', 'dave', 'Dave', 1990, now()),
  ('eeeeeeee-0000-0000-0000-000000000005', 'eve', 'Eve', 1995, now());

-- Accepted friendships: alice-bob, alice-carol, alice-dave, bob-carol,
-- bob-dave. carol-dave are NOT friends. eve has no friends at all.
insert into
  public.friendships (requester_id, addressee_id, status, responded_at)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'accepted',
    now()
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000003',
    'accepted',
    now()
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'dddddddd-0000-0000-0000-000000000004',
    'accepted',
    now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000003',
    'accepted',
    now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'dddddddd-0000-0000-0000-000000000004',
    'accepted',
    now()
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice's friends: bob, carol, dave. Bob's friends: alice, carol, dave.
-- Mutual (excluding each other): carol, dave = 2.
do $$
declare
  v_count integer;
begin
  select public.get_mutual_friend_count('bbbbbbbb-0000-0000-0000-000000000002'::uuid) into v_count;
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 mutual friends between alice and bob, got %', v_count;
  end if;
  raise notice 'PASS: alice and bob have 2 mutual friends (carol, dave)';
end $$;

-- Alice and eve share no friends at all.
do $$
declare
  v_count integer;
begin
  select public.get_mutual_friend_count('eeeeeeee-0000-0000-0000-000000000005'::uuid) into v_count;
  if v_count <> 0 then
    raise exception 'FAIL: expected 0 mutual friends between alice and eve, got %', v_count;
  end if;
  raise notice 'PASS: alice and eve have 0 mutual friends';
end $$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

-- Carol's friends: alice, bob. Dave's friends: alice, bob. Mutual = 2, even
-- though carol and dave aren't friends with each other.
do $$
declare
  v_count integer;
begin
  select public.get_mutual_friend_count('dddddddd-0000-0000-0000-000000000004'::uuid) into v_count;
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 mutual friends between carol and dave, got %', v_count;
  end if;
  raise notice 'PASS: carol and dave (not friends with each other) still share 2 mutual friends';
end $$;

reset role;

-- anon has no execute privilege on the function at all.
set role anon;

do $$
begin
  perform public.get_mutual_friend_count('aaaaaaaa-0000-0000-0000-000000000001'::uuid);
  raise exception 'FAIL: expected anon to be denied execute on get_mutual_friend_count';
exception
  when insufficient_privilege then
    raise notice 'PASS: anon has no execute privilege on get_mutual_friend_count';
end $$;

reset role;

do $$
begin
  raise notice 'mutual_friend_count.test.sql: all assertions passed';
end $$;
