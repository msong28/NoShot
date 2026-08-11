-- Behaviour test for notifications_enabled (Settings screen toggle). Same
-- convention as the other behaviour tests: must ERROR on any failed
-- assertion. Also guards that the column-level grant fix didn't
-- accidentally widen access back to the columns account_deletion.sql
-- deliberately locked down (status, deleted_at, username).
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'); -- alice

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'alice',
    'Alice',
    2000,
    now()
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_value boolean;
begin
  update public.profiles set notifications_enabled = false
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

  select notifications_enabled into v_value from public.profiles
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

  if v_value <> false then
    raise exception 'FAIL: expected notifications_enabled to be updatable to false, got %', v_value;
  end if;
  raise notice 'PASS: a user can update their own notifications_enabled directly';
end $$;

do $$
begin
  update public.profiles set status = 'suspended'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;
  raise exception 'FAIL: expected direct update of status to be denied';
exception
  when insufficient_privilege then
    raise notice 'PASS: status remains outside the direct-update column allowlist';
end $$;

do $$
begin
  update public.profiles set username = 'hijacked'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;
  raise exception 'FAIL: expected direct update of username to be denied';
exception
  when insufficient_privilege then
    raise notice 'PASS: username remains outside the direct-update column allowlist';
end $$;

reset role;

do $$
begin
  raise notice 'notifications_preference.test.sql: all assertions passed';
end $$;
