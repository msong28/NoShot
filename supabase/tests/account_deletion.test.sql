-- Behaviour test for delete_account_request() (Milestone 14). Same
-- convention as friendships_blocks.test.sql: must ERROR on any failed
-- assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice, the one deleting
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob, pending friend request + owns a group
  ('cccccccc-0000-0000-0000-000000000003'), -- carol, accepted friendship with alice
  ('dddddddd-0000-0000-0000-000000000004'); -- dave, owns a second group alice actively joins

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

-- A live session row for alice, so we can assert it's gone afterward.
insert into
  auth.sessions (user_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001');

set role authenticated;

-- Alice sends Bob a friend request that stays pending (never responded to).
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002');
end;
$$;

-- Alice and Carol become actual friends (accepted).
do $$
begin
  perform public.send_friend_request('cccccccc-0000-0000-0000-000000000003');
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_friendship_id uuid;
begin
  select id into v_friendship_id from public.friendships
  where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and addressee_id = 'cccccccc-0000-0000-0000-000000000003';
  perform public.respond_friend_request(v_friendship_id, true);
end;
$$;

-- Bob creates a group and invites Alice, who never responds (stays invited).
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.create_group('Bob''s group');
  perform public.invite_to_group(v_group_id, 'aaaaaaaa-0000-0000-0000-000000000001');
end;
$$;

-- Dave creates a second group and invites Alice, who accepts (active).
set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.create_group('Dave''s group');
  perform public.invite_to_group(v_group_id, 'aaaaaaaa-0000-0000-0000-000000000001');
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.group_members
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and group_id in (select id from public.groups where created_by = 'dddddddd-0000-0000-0000-000000000004');
  perform public.respond_to_group_invite(v_group_id, true);
end;
$$;

-- Direct table update of status is denied -- only the RPC may write it.
-- (Uses alice's literal id rather than auth.uid() in the raw UPDATE itself
-- -- unlike a policy's USING/WITH CHECK expression, which runs with the
-- table owner's privileges, a bare top-level statement by `authenticated`
-- calling auth.uid() needs USAGE on schema auth, which it isn't granted
-- here, so referencing it directly would raise a different, unrelated
-- permission error before ever reaching the column-privilege check.)
do $$
begin
  begin
    update public.profiles set status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'FAIL: expected direct update of profiles.status to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct update of profiles.status denied, must use the RPC';
  end;
end;
$$;

-- But a still-granted column (display_name) can still be updated directly.
do $$
declare
  v_display_name text;
begin
  update public.profiles set display_name = 'Alice Renamed' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select display_name into v_display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_display_name <> 'Alice Renamed' then
    raise exception 'FAIL: expected display_name direct update to succeed, got %', v_display_name;
  end if;
  raise notice 'PASS: display_name remains directly updatable after the grant tightening';
end;
$$;

-- Alice deletes her account.
do $$
declare
  v_row public.profiles;
begin
  select * into v_row from public.delete_account_request();

  if v_row.status <> 'deleted' then
    raise exception 'FAIL: expected status = deleted, got %', v_row.status;
  end if;
  if v_row.deleted_at is null then
    raise exception 'FAIL: expected deleted_at to be set';
  end if;
  if v_row.display_name <> 'Deleted user' then
    raise exception 'FAIL: expected display_name = Deleted user, got %', v_row.display_name;
  end if;
  if v_row.username !~ '^deleted_[0-9a-f]{8}$' then
    raise exception 'FAIL: expected an anonymized placeholder username, got %', v_row.username;
  end if;
  if v_row.birth_year is not null then
    raise exception 'FAIL: expected birth_year to be cleared';
  end if;
  if v_row.age_acknowledged_at is not null then
    raise exception 'FAIL: expected age_acknowledged_at to be cleared';
  end if;

  raise notice 'PASS: delete_account_request anonymizes the profile row';
end;
$$;

-- Deleting again is rejected (idempotency guard).
do $$
begin
  begin
    perform public.delete_account_request();
    raise exception 'FAIL: expected re-deleting an already-deleted account to be rejected';
  exception
    when others then
      if sqlerrm not like '%already deleted%' then raise; end if;
      raise notice 'PASS: cannot delete an already-deleted account';
  end;
end;
$$;

-- The pending friend request to Bob was cancelled as a side effect.
do $$
declare
  v_status public.friendship_status;
begin
  select status into v_status from public.friendships
  where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if v_status <> 'cancelled' then
    raise exception 'FAIL: expected the pending friend request to be cancelled, got %', v_status;
  end if;
  raise notice 'PASS: a pending friend request naming the deleted account is cancelled';
end;
$$;

-- The accepted friendship with Carol is untouched -- that's the coherent
-- history counterparties are meant to keep.
do $$
declare
  v_status public.friendship_status;
begin
  select status into v_status from public.friendships
  where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and addressee_id = 'cccccccc-0000-0000-0000-000000000003';
  if v_status <> 'accepted' then
    raise exception 'FAIL: expected the accepted friendship to remain accepted, got %', v_status;
  end if;
  raise notice 'PASS: an accepted friendship survives account deletion untouched';
end;
$$;

-- The still-invited group membership (Bob's group) is declined.
do $$
declare
  v_status public.group_member_status;
begin
  select status into v_status from public.group_members
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and group_id in (select id from public.groups where created_by = 'bbbbbbbb-0000-0000-0000-000000000002');
  if v_status <> 'declined' then
    raise exception 'FAIL: expected the pending group invite to be declined, got %', v_status;
  end if;
  raise notice 'PASS: a pending group invite naming the deleted account is declined';
end;
$$;

-- The active group membership (Dave's group) is untouched.
do $$
declare
  v_status public.group_member_status;
begin
  select status into v_status from public.group_members
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and group_id in (select id from public.groups where created_by = 'dddddddd-0000-0000-0000-000000000004');
  if v_status <> 'active' then
    raise exception 'FAIL: expected the active group membership to remain active, got %', v_status;
  end if;
  raise notice 'PASS: an active group membership survives account deletion untouched';
end;
$$;

-- Alice's session row was revoked.
reset role;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from auth.sessions
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 0 then
    raise exception 'FAIL: expected the deleted account''s session(s) to be revoked, saw %', v_count;
  end if;
  raise notice 'PASS: delete_account_request revokes the account''s sessions';
end;
$$;

-- anon cannot call the RPC at all.
set role anon;

do $$
begin
  begin
    perform public.delete_account_request();
    raise exception 'FAIL: expected anon to be denied execute on delete_account_request';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no execute access to delete_account_request';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'account_deletion.test.sql: all assertions passed';
end;
$$;
