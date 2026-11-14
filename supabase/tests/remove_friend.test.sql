-- remove_friend(): unfriend without blocking. Must ERROR on any failed assertion.
insert into auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-0000000000a1'), -- alice
  ('bbbbbbbb-0000-0000-0000-0000000000b2'), -- bob
  ('cccccccc-0000-0000-0000-0000000000c3'); -- carol (never a friend)

insert into public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'rf_alice', 'Alice', 2000, now()),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', 'rf_bob', 'Bob', 1998, now()),
  ('cccccccc-0000-0000-0000-0000000000c3', 'rf_carol', 'Carol', 1997, now());

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000a1';

do $$
declare
  v_id uuid;
begin
  select id into v_id from public.send_friend_request('bbbbbbbb-0000-0000-0000-0000000000b2');
  set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-0000000000b2';
  perform public.respond_friend_request(v_id, true);
  set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000a1';
end;
$$;

-- Not friends -> rejected.
do $$
begin
  begin
    perform public.remove_friend('cccccccc-0000-0000-0000-0000000000c3');
    raise exception 'FAIL: expected unfriending a non-friend to be rejected';
  exception
    when others then
      if sqlerrm not like '%not friends%' then raise; end if;
      raise notice 'PASS: cannot unfriend someone who is not a friend';
  end;
end;
$$;

-- Yourself -> rejected.
do $$
begin
  begin
    perform public.remove_friend('aaaaaaaa-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: expected unfriending yourself to be rejected';
  exception
    when others then
      if sqlerrm not like '%yourself%' then raise; end if;
      raise notice 'PASS: cannot unfriend yourself';
  end;
end;
$$;

-- Alice unfriends Bob: friendship ends, but NO block row is created.
do $$
declare
  v_status public.friendship_status;
  v_blocks integer;
begin
  perform public.remove_friend('bbbbbbbb-0000-0000-0000-0000000000b2');

  select status into v_status from public.friendships
  where (requester_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and addressee_id = 'bbbbbbbb-0000-0000-0000-0000000000b2');
  if v_status <> 'cancelled' then
    raise exception 'FAIL: expected cancelled friendship, got %', v_status;
  end if;

  select count(*) into v_blocks from public.blocks;
  if v_blocks <> 0 then
    raise exception 'FAIL: unfriending must not create a block (found %)', v_blocks;
  end if;
  raise notice 'PASS: unfriend ends the friendship without blocking';
end;
$$;

-- Either side can send a fresh request afterwards.
do $$
begin
  perform public.send_friend_request('bbbbbbbb-0000-0000-0000-0000000000b2');
  raise notice 'PASS: a new request can be sent after unfriending';
end;
$$;

-- Unfriending twice -> rejected.
do $$
begin
  begin
    -- that fresh request is pending, not accepted, so there is nothing to unfriend
    perform public.remove_friend('bbbbbbbb-0000-0000-0000-0000000000b2');
    raise exception 'FAIL: expected second unfriend to be rejected';
  exception
    when others then
      if sqlerrm not like '%not friends%' then raise; end if;
      raise notice 'PASS: unfriend only applies to accepted friendships';
  end;
end;
$$;
