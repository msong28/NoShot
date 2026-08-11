-- Behaviour test for friendships/blocks/search (Milestone 3). Same
-- convention as profiles_rls.test.sql: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'), -- carol
  ('dddddddd-0000-0000-0000-000000000004'), -- dave
  ('eeeeeeee-0000-0000-0000-000000000005'), -- eve
  ('ffffffff-0000-0000-0000-000000000006'); -- frank, for the search tests below

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
  ),
  (
    'eeeeeeee-0000-0000-0000-000000000005',
    'eve',
    'Eve',
    1995,
    now()
  ),
  (
    -- Display name doesn't share a substring with the username, so a
    -- display-name-only query below can only succeed via the broadened match.
    'ffffffff-0000-0000-0000-000000000006',
    'frankxyz',
    'Frankie Zephyr',
    1994,
    now()
  );

-- 12 more profiles sharing a distinctive substring, to check the search
-- results cap below.
insert into
  auth.users (id)
select
  ('a0000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid
from
  generate_series(1, 12) as i;

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
select
  ('a0000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid,
  'manyresult' || lpad(i::text, 2, '0'),
  'Many Result ' || i,
  1990,
  now()
from
  generate_series(1, 12) as i;

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice cannot friend-request herself.
do $$
begin
  begin
    perform public.send_friend_request('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: expected self friend request to be rejected';
  exception
    when others then
      if sqlerrm not like '%yourself%' then raise; end if;
      raise notice 'PASS: cannot send a friend request to yourself';
  end;
end;
$$;

-- Direct table insert must be denied -- only the function may write.
do $$
begin
  begin
    insert into public.friendships (requester_id, addressee_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'FAIL: expected direct insert into friendships to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into friendships denied, must use the RPC';
  end;
end;
$$;

-- Alice sends Bob a request via the RPC.
do $$
declare
  v_id uuid;
  v_status public.friendship_status;
begin
  select id, status into v_id, v_status from public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002');
  if v_status <> 'pending' then
    raise exception 'FAIL: expected new request to be pending, got %', v_status;
  end if;
  raise notice 'PASS: alice sent bob a pending friend request (%)', v_id;
end;
$$;

-- A duplicate active request between the same pair must be rejected.
do $$
begin
  begin
    perform public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'FAIL: expected duplicate active request to be rejected';
  exception
    when others then
      if sqlerrm not like '%already exists%' then raise; end if;
      raise notice 'PASS: duplicate active friend request rejected';
  end;
end;
$$;

-- Carol cannot see Alice and Bob's friendship row (not a party to it).
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.friendships
  where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_count <> 0 then
    raise exception 'FAIL: expected carol to see 0 rows of alice/bob''s friendship, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see another pair''s friendship row';
end;
$$;

-- Bob cannot accept it as if he were Alice; must be Alice trying to accept
-- her own outgoing request -- respond_friend_request requires being the
-- addressee, so Alice attempting to respond to her own request must fail.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_friendship_id uuid;
begin
  select id into v_friendship_id from public.friendships
  where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  begin
    perform public.respond_friend_request(v_friendship_id, true);
    raise exception 'FAIL: expected the requester to be unable to respond to their own request';
  exception
    when others then
      if sqlerrm not like '%no pending friend request found for you%' then raise; end if;
      raise notice 'PASS: only the addressee can respond to a friend request';
  end;
end;
$$;

-- Bob accepts.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_friendship_id uuid;
  v_status public.friendship_status;
begin
  select id into v_friendship_id from public.friendships
  where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  select status into v_status from public.respond_friend_request(v_friendship_id, true);
  if v_status <> 'accepted' then
    raise exception 'FAIL: expected accepted, got %', v_status;
  end if;
  raise notice 'PASS: bob accepted alice''s friend request';
end;
$$;

-- Dave and Eve become friends, then Eve blocks Dave -- the friendship must
-- be cancelled as a side effect (FR-05).
set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
begin
  perform public.send_friend_request('eeeeeeee-0000-0000-0000-000000000005');
end;
$$;

set
  request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';

do $$
declare
  v_friendship_id uuid;
begin
  select id into v_friendship_id from public.friendships
  where requester_id = 'dddddddd-0000-0000-0000-000000000004'
    and addressee_id = 'eeeeeeee-0000-0000-0000-000000000005';
  perform public.respond_friend_request(v_friendship_id, true);
  perform public.block_user('dddddddd-0000-0000-0000-000000000004');
end;
$$;

do $$
declare
  v_status public.friendship_status;
begin
  select status into v_status from public.friendships
  where requester_id = 'dddddddd-0000-0000-0000-000000000004'
    and addressee_id = 'eeeeeeee-0000-0000-0000-000000000005';

  if v_status <> 'cancelled' then
    raise exception 'FAIL: expected blocking to cancel the active friendship, got %', v_status;
  end if;
  raise notice 'PASS: blocking cancels an existing active friendship';
end;
$$;

-- Dave cannot re-friend Eve while blocked.
set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
begin
  begin
    perform public.send_friend_request('eeeeeeee-0000-0000-0000-000000000005');
    raise exception 'FAIL: expected friend request to a blocker to be rejected';
  exception
    when others then
      if sqlerrm not like '%cannot send a friend request to this user%' then raise; end if;
      raise notice 'PASS: cannot send a friend request across an active block';
  end;
end;
$$;

-- Username search: prefix match, excludes self and blocked users, enforces
-- a minimum query length.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  begin
    perform public.search_profiles_by_username('bo');
    raise exception 'FAIL: expected a too-short query to be rejected';
  exception
    when others then
      if sqlerrm not like '%at least 3 characters%' then raise; end if;
      raise notice 'PASS: search rejects queries under 3 characters';
  end;

  select count(*) into v_count from public.search_profiles_by_username('bob');
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 match for ''bob'', got %', v_count;
  end if;
  raise notice 'PASS: username prefix search finds the right user';

  -- Not just a prefix match -- 'arol' only appears mid-string in 'carol'.
  select count(*) into v_count from public.search_profiles_by_username('arol');
  if v_count <> 1 then
    raise exception 'FAIL: expected a substring (non-prefix) match on username, got %', v_count;
  end if;
  raise notice 'PASS: search matches a substring anywhere in the username, not just a prefix';
end;
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.search_profiles_by_username('zephyr');
  if v_count <> 1 then
    raise exception 'FAIL: expected search to match on display_name too, got %', v_count;
  end if;
  raise notice 'PASS: search matches on display_name as well as username';
end;
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.search_profiles_by_username('manyresult');
  if v_count <> 10 then
    raise exception 'FAIL: expected search results capped at 10, got %', v_count;
  end if;
  raise notice 'PASS: search results are capped at 10';
end;
$$;

set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.search_profiles_by_username('eve');
  if v_count <> 0 then
    raise exception 'FAIL: expected a blocked user to be excluded from search results, saw %', v_count;
  end if;
  raise notice 'PASS: search excludes users with an active block';
end;
$$;

-- get_profiles_for_relations only returns ids the caller has a relation with.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.get_profiles_for_relations (
    array['bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'cccccccc-0000-0000-0000-000000000003'::uuid]
  );
  if v_count <> 1 then
    raise exception 'FAIL: expected only bob (a real relation) to be returned, got % rows', v_count;
  end if;
  raise notice 'PASS: get_profiles_for_relations excludes ids with no relation to the caller';
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.friendships limit 1;
    raise exception 'FAIL: expected anon SELECT on friendships to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to friendships';
  end;
end;
$$;

-- Anon can still preview an invite by exact known username (FR-04).
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.get_invite_preview('alice');
  if v_count <> 1 then
    raise exception 'FAIL: expected anon to preview a known username, got % rows', v_count;
  end if;

  select count(*) into v_count from public.get_invite_preview('nobody_with_this_name');
  if v_count <> 0 then
    raise exception 'FAIL: expected an unknown username to preview to 0 rows, got %', v_count;
  end if;

  raise notice 'PASS: anon can preview an invite by exact username, unknown usernames return nothing';
end;
$$;

reset role;

do $$
begin
  raise notice 'friendships_blocks.test.sql: all assertions passed';
end;
$$;
