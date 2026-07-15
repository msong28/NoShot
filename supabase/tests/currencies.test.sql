-- Behaviour test for currencies + moderate_text (Milestone 5). Same
-- convention as the other test files: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'); -- carol

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

-- moderate_text() tiers, checked directly (no auth context needed).
do $$
begin
  if public.moderate_text('Cocaine Run') <> 'block' then
    raise exception 'FAIL: expected a hard-block term to return block';
  end if;
  if public.moderate_text('Tequila Shots') <> 'warn' then
    raise exception 'FAIL: expected an ambiguous term to return warn';
  end if;
  if public.moderate_text('Pizza Night') <> 'permit' then
    raise exception 'FAIL: expected a benign term to return permit';
  end if;
  raise notice 'PASS: moderate_text() sorts block/warn/permit correctly';
end;
$$;

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Built-in currencies are visible to any authenticated user.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.currencies where is_builtin;
  if v_count < 1 then
    raise exception 'FAIL: expected at least one built-in currency, saw %', v_count;
  end if;
  raise notice 'PASS: built-in currencies are visible (% found)', v_count;
end;
$$;

-- Alice creates a benign personal currency -- approved immediately.
do $$
declare
  v_status public.currency_moderation_status;
  v_is_builtin boolean;
begin
  insert into public.currencies (name, category, owner_user_id)
  values ('Pizza Night', 'food', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning moderation_status, is_builtin into v_status, v_is_builtin;

  if v_status <> 'approved' or v_is_builtin then
    raise exception 'FAIL: expected an approved, non-builtin currency, got % / builtin=%', v_status, v_is_builtin;
  end if;
  raise notice 'PASS: a benign personal currency is created and approved';
end;
$$;

-- A hard-block name is rejected outright -- no row is created.
do $$
begin
  begin
    insert into public.currencies (name, category, owner_user_id)
    values ('Cocaine Run', 'actions', 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: expected a hard-blocked currency name to be rejected';
  exception
    when others then
      if sqlerrm not like '%isn''t allowed%' then raise; end if;
      raise notice 'PASS: a hard-blocked currency name is rejected';
  end;
end;
$$;

-- A warn-tier name is created but queued for review.
do $$
declare
  v_status public.currency_moderation_status;
begin
  insert into public.currencies (name, category, owner_user_id)
  values ('Tequila Shots', 'drinks', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning moderation_status into v_status;

  if v_status <> 'pending_review' then
    raise exception 'FAIL: expected an ambiguous currency to be pending_review, got %', v_status;
  end if;
  raise notice 'PASS: an ambiguous currency name is created but queued for review';
end;
$$;

-- The moderation gate cannot be spoofed via is_builtin=true on the insert.
do $$
declare
  v_is_builtin boolean;
begin
  insert into public.currencies (name, category, owner_user_id, is_builtin)
  values ('Sneaky Builtin', 'items', 'aaaaaaaa-0000-0000-0000-000000000001', true)
  returning is_builtin into v_is_builtin;

  if v_is_builtin then
    raise exception 'FAIL: expected the trigger to force is_builtin to false';
  end if;
  raise notice 'PASS: a client-supplied is_builtin=true is overridden by the trigger';
end;
$$;

-- Same name, same owner, different case -- rejected as a duplicate.
do $$
begin
  begin
    insert into public.currencies (name, category, owner_user_id)
    values ('pizza night', 'food', 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: expected a case-insensitive duplicate name to be rejected';
  exception
    when unique_violation then
      raise notice 'PASS: duplicate personal currency names (case-insensitive) are rejected';
  end;
end;
$$;

-- Bob cannot see Alice's personal currency.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.currencies where name = 'Pizza Night';
  if v_count <> 0 then
    raise exception 'FAIL: expected bob to see 0 rows of alice''s personal currency, saw %', v_count;
  end if;
  raise notice 'PASS: a personal currency is invisible to another user';
end;
$$;

-- A group-scoped currency is visible to fellow members but not outsiders.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.create_group('Roommates');
  perform public.invite_to_group(v_group_id, 'bbbbbbbb-0000-0000-0000-000000000002');

  insert into public.currencies (name, category, group_id)
  values ('House Points', 'points', v_group_id);
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.currencies where name = 'House Points';
  if v_count <> 0 then
    raise exception 'FAIL: expected a non-member to see 0 rows of a group currency, saw %', v_count;
  end if;
  raise notice 'PASS: a group currency is invisible to a non-member';
end;
$$;

-- A non-member cannot insert a currency scoped to a group they're not in.
do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where name = 'Roommates';
  begin
    insert into public.currencies (name, category, group_id)
    values ('Intruder Currency', 'items', v_group_id);
    raise exception 'FAIL: expected a non-member group currency insert to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: a non-member cannot create a currency scoped to that group';
  end;
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.currencies limit 1;
    raise exception 'FAIL: expected anon SELECT on currencies to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to currencies';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'currencies.test.sql: all assertions passed';
end;
$$;
