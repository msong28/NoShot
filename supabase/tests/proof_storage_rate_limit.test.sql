-- Behaviour test for 20260723150000_proof_storage_rate_limit.sql: the
-- storage.objects trigger must throttle direct writes to the proof-assets
-- bucket even when the client never calls upload_proof() at all -- the gap
-- that migration closed (see its own comment for why a plain RPC-level
-- limit isn't enough). Same convention as the other rate-limit tests: must
-- ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'); -- bob

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
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Dishes tonight', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.bet_id', v_bet_id::text, false);
end;
$$;

reset role;

-- Seed alice at exactly 29 prior "proof_storage_upload" entries -- one
-- below the trigger's own limit (30/hour), independent of upload_proof's
-- own 20/hour "upload_proof" counter.
insert into public.rate_limit_log (user_id, action)
select 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'proof_storage_upload'
from generate_series(1, 29);

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice's 30th direct storage write this hour is her last allowed one --
-- note this never calls upload_proof(), only inserts into storage.objects
-- directly, exactly like a client hitting the Storage REST API on its own.
do $$
begin
  insert into storage.objects (bucket_id, name, owner)
  values ('proof-assets', current_setting('test.bet_id') || '/spam-30.jpg', 'aaaaaaaa-0000-0000-0000-000000000001');
  raise notice 'PASS: the 30th direct storage write within the hour still succeeds';
exception
  when others then
    raise exception 'FAIL: expected the 30th storage write to succeed, got: %', sqlerrm;
end $$;

-- Her 31st is rejected by the trigger before it ever reaches the table.
do $$
begin
  insert into storage.objects (bucket_id, name, owner)
  values ('proof-assets', current_setting('test.bet_id') || '/spam-31.jpg', 'aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'FAIL: expected the 31st direct storage write within the hour to be rate-limited';
exception
  when others then
    if sqlerrm not like '%too many requests%' then raise; end if;
    raise notice 'PASS: direct storage.objects inserts into proof-assets are gated by the trigger once alice hits 30/hour, bypassing upload_proof() entirely';
end $$;

reset role;

do $$
begin
  raise notice 'proof_storage_rate_limit.test.sql: all assertions passed';
end $$;
