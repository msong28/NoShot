-- RLS/behaviour test for the profiles migration. Run via
-- scripts/test-db.sh, which applies all migrations to a throwaway
-- Postgres instance first, then runs every file in this directory.
--
-- Convention: this file must ERROR (nonzero psql exit, thanks to
-- ON_ERROR_STOP=1) if any assertion fails.
insert into
  auth.users (id)
values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'alice',
    'Alice',
    2000,
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'bob',
    'Bob',
    1998,
    now()
  );

-- An underage birth_year must be rejected by the enforce_min_age trigger.
do $$
begin
  begin
    insert into
      public.profiles (id, username, display_name, birth_year)
    values
      (
        gen_random_uuid (),
        'toolyoung',
        'Too Young',
        (extract(year from now())::integer - 10)
      );
    raise exception 'FAIL: expected underage insert to be rejected';
  exception
    when others then
      if sqlerrm not like '%below the minimum of 16%' then
        raise;
      end if;
      raise notice 'PASS: underage insert rejected';
  end;
end;
$$;

-- Usernames must be unique.
do $$
begin
  begin
    insert into
      public.profiles (id, username, display_name)
    values
      (gen_random_uuid (), 'alice', 'Impersonator');
    raise exception 'FAIL: expected duplicate username insert to be rejected';
  exception
    when unique_violation then
      raise notice 'PASS: duplicate username rejected';
  end;
end;
$$;

-- RLS, exercised as the `authenticated` role the way PostgREST does it in
-- production (SET ROLE per request, driven by the request.jwt.claim.sub
-- GUC) -- NOT as the postgres superuser, which bypasses RLS entirely.
-- SET/RESET ROLE must stay top-level statements (not inside a DO block);
-- the DO blocks below just assert against whatever role is currently active.
set role authenticated;

set
  request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  self_count integer;
  other_count integer;
begin
  select count(*) into self_count from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  select count(*) into other_count from public.profiles where id = '22222222-2222-2222-2222-222222222222';

  if self_count != 1 then
    raise exception 'FAIL: expected to see own profile row, saw %', self_count;
  end if;
  if other_count != 0 then
    raise exception 'FAIL: expected NOT to see another user''s profile row, saw %', other_count;
  end if;

  raise notice 'PASS: a user sees only their own profile row';
end;
$$;

-- RLS should filter this update's target to zero rows (no error, just no
-- effect) rather than let it touch another user's row.
update public.profiles
set
  display_name = 'Hacked'
where
  id = '22222222-2222-2222-2222-222222222222';

reset role;

do $$
declare
  bob_name text;
begin
  select display_name into bob_name from public.profiles where id = '22222222-2222-2222-2222-222222222222';

  if bob_name != 'Bob' then
    raise exception 'FAIL: another user''s row was modified, expected ''Bob'', got %', bob_name;
  end if;

  raise notice 'PASS: a user cannot update another user''s profile row';
end;
$$;

-- anon has no table-level access at all.
set role anon;

do $$
begin
  begin
    perform
      1
    from
      public.profiles
    limit
      1;
    raise exception 'FAIL: expected anon SELECT to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to profiles';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'profiles_rls.test.sql: all assertions passed';
end;
$$;
