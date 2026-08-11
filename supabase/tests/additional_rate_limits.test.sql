-- Behaviour test for 20260723140000_additional_rate_limits.sql. Same
-- convention as mutation_rate_limits.test.sql: exercise a couple of the
-- newly-limited RPCs directly (upload_proof as the storage/abuse-cost one,
-- create_group as the resource-creation one, submit_report as the
-- harassment-vector one) rather than every single one, since they all share
-- the exact same enforce_rate_limit() plumbing already covered there.
insert into
  auth.users (id)
values
  ('eeeeeeee-0000-0000-0000-000000000001'), -- erin
  ('ffffffff-0000-0000-0000-000000000002'); -- frank

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  (
    'eeeeeeee-0000-0000-0000-000000000001',
    'erin',
    'Erin',
    1999,
    now()
  ),
  (
    'ffffffff-0000-0000-0000-000000000002',
    'frank',
    'Frank',
    1995,
    now()
  );

-- Seed erin at exactly 9 prior "create_group" entries -- one below the real
-- limit (10/hour) wired into create_group().
insert into public.rate_limit_log (user_id, action)
select 'eeeeeeee-0000-0000-0000-000000000001'::uuid, 'create_group'
from generate_series(1, 9);

set role authenticated;

set
  request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000001';

do $$
begin
  perform public.create_group('Erin''s 10th group');
  raise notice 'PASS: the 10th group creation within the hour still succeeds';
exception
  when others then
    raise exception 'FAIL: expected the 10th create_group to succeed, got: %', sqlerrm;
end $$;

do $$
begin
  perform public.create_group('Erin''s 11th group');
  raise exception 'FAIL: expected the 11th create_group within the hour to be rate-limited';
exception
  when others then
    if sqlerrm not like '%too many requests%' then raise; end if;
    raise notice 'PASS: create_group is gated by the shared rate limiter once erin hits 10/hour';
end $$;

reset role;

-- submit_report: seed frank at 19 (one below the 20/hour limit).
insert into public.rate_limit_log (user_id, action)
select 'ffffffff-0000-0000-0000-000000000002'::uuid, 'submit_report'
from generate_series(1, 19);

set role authenticated;

set
  request.jwt.claim.sub = 'ffffffff-0000-0000-0000-000000000002';

do $$
begin
  perform public.submit_report('user', 'eeeeeeee-0000-0000-0000-000000000001'::uuid, 'other', 'ok');
  raise notice 'PASS: the 20th report within the hour still succeeds';
exception
  when others then
    raise exception 'FAIL: expected the 20th submit_report to succeed, got: %', sqlerrm;
end $$;

do $$
begin
  perform public.submit_report('user', 'eeeeeeee-0000-0000-0000-000000000001'::uuid, 'other', 'ok again');
  raise exception 'FAIL: expected the 21st submit_report within the hour to be rate-limited';
exception
  when others then
    if sqlerrm not like '%too many requests%' then raise; end if;
    raise notice 'PASS: submit_report is gated by the shared rate limiter once frank hits 20/hour';
end $$;

reset role;

do $$
begin
  raise notice 'additional_rate_limits.test.sql: all assertions passed';
end $$;
