-- Behaviour test for groups/group_members (Milestone 4). Same convention as
-- profiles_rls.test.sql: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'), -- carol
  ('dddddddd-0000-0000-0000-000000000004'), -- dave
  ('eeeeeeee-0000-0000-0000-000000000005'); -- eve

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
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice creates a group and lands as its sole active owner.
do $$
declare
  v_group_id uuid;
  v_role public.group_member_role;
  v_status public.group_member_status;
begin
  select id into v_group_id from public.create_group('Roommates');

  select role, status into v_role, v_status
  from public.group_members
  where group_id = v_group_id and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  if v_role <> 'owner' or v_status <> 'active' then
    raise exception 'FAIL: expected creator to be an active owner, got % / %', v_role, v_status;
  end if;
  raise notice 'PASS: alice created a group and is its active owner';
end;
$$;

-- Direct table insert must be denied -- only the functions may write.
do $$
begin
  begin
    insert into public.groups (name, created_by)
    values ('Sneaky Group', 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: expected direct insert into groups to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into groups denied, must use the RPC';
  end;
end;
$$;

-- Alice invites Bob; Bob lands as an invited (not yet active) member.
do $$
declare
  v_group_id uuid;
  v_status public.group_member_status;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';

  select status into v_status from public.invite_to_group(v_group_id, 'bbbbbbbb-0000-0000-0000-000000000002');
  if v_status <> 'invited' then
    raise exception 'FAIL: expected bob to be invited, got %', v_status;
  end if;
  raise notice 'PASS: alice invited bob, who is now invited (not yet active)';
end;
$$;

-- Alice cannot invite herself.
do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public.invite_to_group(v_group_id, 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: expected self-invite to be rejected';
  exception
    when others then
      if sqlerrm not like '%yourself%' then raise; end if;
      raise notice 'PASS: cannot invite yourself to a group';
  end;
end;
$$;

-- Inviting the same person twice while their invite is still pending fails.
do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public.invite_to_group(v_group_id, 'bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'FAIL: expected duplicate invite to be rejected';
  exception
    when others then
      if sqlerrm not like '%already has a membership record%' then raise; end if;
      raise notice 'PASS: duplicate invite to the same group rejected';
  end;
end;
$$;

-- Carol (uninvolved) cannot see the group or its roster.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 0 then
    raise exception 'FAIL: expected carol to see 0 groups she is not a member of, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see a group they are not part of';
end;
$$;

-- Bob (not yet an active member) cannot act as owner: remove/archive fail.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public.archive_group(v_group_id);
    raise exception 'FAIL: expected non-owner archive to be rejected';
  exception
    when others then
      if sqlerrm not like '%only the group owner%' then raise; end if;
      raise notice 'PASS: only the group owner can archive the group';
  end;
end;
$$;

-- Bob accepts his invite and becomes an active member.
do $$
declare
  v_group_id uuid;
  v_status public.group_member_status;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  select status into v_status from public.respond_to_group_invite(v_group_id, true);
  if v_status <> 'active' then
    raise exception 'FAIL: expected bob to become active, got %', v_status;
  end if;
  raise notice 'PASS: bob accepted his group invite and is now active';
end;
$$;

-- Now that Bob is active, he can see the group and its roster.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 1 then
    raise exception 'FAIL: expected bob to see the group he just joined, saw %', v_count;
  end if;
  raise notice 'PASS: an active member can see their group';
end;
$$;

-- get_group_member_profiles returns the roster (profiles' own RLS would
-- otherwise hide everyone but the caller). Stash the group id in a GUC so
-- the next block can reuse the real id even under a role that can't see it
-- via a plain SELECT.
do $$
declare
  v_group_id uuid;
  v_count integer;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform set_config('test.group_id', v_group_id::text, false);

  select count(*) into v_count from public.get_group_member_profiles(v_group_id);
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 member profiles (alice, bob), got %', v_count;
  end if;
  raise notice 'PASS: get_group_member_profiles returns the roster for a member';
end;
$$;

-- Carol (not a member, but who somehow knows the real group id) gets
-- nothing back for that group's roster.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.get_group_member_profiles(current_setting('test.group_id')::uuid);
  if v_count <> 0 then
    raise exception 'FAIL: expected a non-member to get 0 roster rows, got %', v_count;
  end if;
  raise notice 'PASS: get_group_member_profiles returns nothing for a non-member';
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice invites Dave; Dave declines.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform public.invite_to_group(v_group_id, 'dddddddd-0000-0000-0000-000000000004');
end;
$$;

set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  v_group_id uuid;
  v_status public.group_member_status;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  select status into v_status from public.respond_to_group_invite(v_group_id, false);
  if v_status <> 'declined' then
    raise exception 'FAIL: expected dave to be declined, got %', v_status;
  end if;
  raise notice 'PASS: dave declined his group invite';
end;
$$;

-- Bob (active member, not owner) cannot remove Alice.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public.remove_member(v_group_id, 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: expected non-owner remove to be rejected';
  exception
    when others then
      if sqlerrm not like '%only the group owner%' then raise; end if;
      raise notice 'PASS: only the group owner can remove a member';
  end;
end;
$$;

-- Owner Alice removes Bob.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_id uuid;
  v_status public.group_member_status;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  select status into v_status from public.remove_member(v_group_id, 'bbbbbbbb-0000-0000-0000-000000000002');
  if v_status <> 'removed' then
    raise exception 'FAIL: expected bob to be removed, got %', v_status;
  end if;
  raise notice 'PASS: owner removed an active member';
end;
$$;

-- Removing an already-removed member fails.
do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public.remove_member(v_group_id, 'bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'FAIL: expected re-removing bob to be rejected';
  exception
    when others then
      if sqlerrm not like '%not an active member%' then raise; end if;
      raise notice 'PASS: cannot remove a member who is already removed';
  end;
end;
$$;

-- Eve joins, then leaves under her own steam via leave_group.
do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform public.invite_to_group(v_group_id, 'eeeeeeee-0000-0000-0000-000000000005');
end;
$$;

set
  request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';

do $$
declare
  v_group_id uuid;
  v_status public.group_member_status;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform public.respond_to_group_invite(v_group_id, true);
  perform public.leave_group(v_group_id);

  select status into v_status from public.group_members
  where group_id = v_group_id and user_id = 'eeeeeeee-0000-0000-0000-000000000005';
  if v_status <> 'left' then
    raise exception 'FAIL: expected eve to have left, got %', v_status;
  end if;
  raise notice 'PASS: eve joined and then left the group on her own';
end;
$$;

-- Blocking prevents inviting that person to a group (reuses Milestone 3's
-- block_user, which works between any two users regardless of friendship).
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  perform public.block_user('dddddddd-0000-0000-0000-000000000004');
end;
$$;

do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.create_group('Carol''s Group');
  begin
    perform public.invite_to_group(v_group_id, 'dddddddd-0000-0000-0000-000000000004');
    raise exception 'FAIL: expected invite across an active block to be rejected';
  exception
    when others then
      if sqlerrm not like '%cannot invite this user%' then raise; end if;
      raise notice 'PASS: cannot invite a blocked user to a group';
  end;
end;
$$;

-- Owner archives their group.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_id uuid;
  v_status public.group_status;
begin
  select id into v_group_id from public.groups where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  select status into v_status from public.archive_group(v_group_id);
  if v_status <> 'archived' then
    raise exception 'FAIL: expected the group to be archived, got %', v_status;
  end if;
  raise notice 'PASS: owner archived the group';
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.groups limit 1;
    raise exception 'FAIL: expected anon SELECT on groups to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to groups';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'groups_membership.test.sql: all assertions passed';
end;
$$;
