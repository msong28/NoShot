-- Behaviour test for enforce_rate_limit() and its wiring into
-- send_friend_request() (representative of the other four call sites --
-- create_or_counter_bet/invite_to_group/post_comment/post_chat_message all
-- call the exact same shared function the same way). enforce_rate_limit()
-- itself is never granted to authenticated/anon (only called from within
-- other SECURITY DEFINER function bodies), so it's exercised here only
-- through the real RPC, not called directly. Same convention as the other
-- behaviour tests: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'), -- carol
  ('dddddddd-0000-0000-0000-000000000004'); -- dave

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

-- Seed alice at exactly 19 prior "friend_request" entries -- one below the
-- real limit (20/hour) wired into send_friend_request().
insert into public.rate_limit_log (user_id, action)
select 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'friend_request'
from generate_series(1, 19);

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice's 20th friend request this hour is her last allowed one.
do $$
begin
  perform public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002'::uuid);
  raise notice 'PASS: the 20th friend request within the hour still succeeds';
exception
  when others then
    raise exception 'FAIL: expected the 20th request to succeed, got: %', sqlerrm;
end $$;

-- Her 21st is rejected by the shared rate limiter.
do $$
begin
  perform public.send_friend_request('cccccccc-0000-0000-0000-000000000003'::uuid);
  raise exception 'FAIL: expected the 21st friend request within the hour to be rate-limited';
exception
  when others then
    if sqlerrm not like '%too many requests%' then raise; end if;
    raise notice 'PASS: send_friend_request is gated by the shared rate limiter once alice hits 20/hour';
end $$;

-- Bob has his own independent counter -- unaffected by alice's usage.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.send_friend_request('dddddddd-0000-0000-0000-000000000004'::uuid);
  raise notice 'PASS: a different user is not affected by another user''s rate-limit usage';
exception
  when others then
    raise exception 'FAIL: expected bob to have an independent counter, got: %', sqlerrm;
end $$;

reset role;

-- enforce_rate_limit() itself is not directly callable by anon or
-- authenticated -- only from inside other SECURITY DEFINER bodies.
set role authenticated;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  perform public.enforce_rate_limit('anything', 100, interval '1 hour');
  raise exception 'FAIL: expected authenticated to be denied direct execute on enforce_rate_limit';
exception
  when insufficient_privilege then
    raise notice 'PASS: enforce_rate_limit is not directly callable by authenticated, only via the RPCs that wrap it';
end $$;

reset role;

set role anon;

do $$
begin
  perform public.enforce_rate_limit('anything', 100, interval '1 hour');
  raise exception 'FAIL: expected anon to be denied execute on enforce_rate_limit';
exception
  when insufficient_privilege then
    raise notice 'PASS: anon has no execute privilege on enforce_rate_limit';
end $$;

reset role;

do $$
begin
  raise notice 'mutation_rate_limits.test.sql: all assertions passed';
end $$;
