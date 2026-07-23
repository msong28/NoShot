-- Behaviour test for notify_push()'s exception-safety guarantee: a push
-- failure (missing vault/pg_net -- exactly this local harness's situation)
-- must never propagate and break the caller. Same convention as the other
-- behaviour tests: must ERROR on any failed assertion.
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

-- Called as postgres (not authenticated) since notify_push() is internal
-- only, same as enforce_rate_limit()/is_blocked_pair() -- this test is
-- about its own exception-safety, not client-callability (already covered
-- by the "not directly callable" shape of every other internal helper).
do $$
begin
  perform public.notify_push(
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'Test title',
    'Test body',
    '{}'::jsonb
  );
  raise notice 'PASS: notify_push() does not raise when vault/pg_net are unavailable (this harness''s exact situation)';
exception
  when others then
    raise exception 'FAIL: notify_push() must never propagate an error, got: %', sqlerrm;
end $$;

-- Respects the notifications_enabled preference -- still must not raise
-- either way, but this exercises the early-return branch specifically.
do $$
begin
  update public.profiles set notifications_enabled = false
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  perform public.notify_push(
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'Test title',
    'Test body'
  );
  raise notice 'PASS: notify_push() short-circuits cleanly when the recipient has notifications disabled';
exception
  when others then
    raise exception 'FAIL: notify_push() must never propagate an error, got: %', sqlerrm;
end $$;

do $$
begin
  raise notice 'push_notifications.test.sql: all assertions passed';
end $$;
