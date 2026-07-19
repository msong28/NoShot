-- Behaviour test for image proof (Milestone 12 / SOC-04, SOC-05). Same
-- convention as the other behaviour tests: must ERROR on any failed
-- assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'); -- carol (uninvolved)

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

-- Carol (uninvolved) cannot write to storage under this bet's path.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('proof-assets', current_setting('test.bet_id') || '/sneaky.jpg', 'cccccccc-0000-0000-0000-000000000003');
    raise exception 'FAIL: expected a non-participant to be denied writing proof to storage';
  exception
    when insufficient_privilege then
      raise notice 'PASS: only a bet participant can write proof objects for this bet to storage';
  end;
end;
$$;

-- Alice (a participant) "uploads" the file (simulated as a direct storage
-- insert, standing in for the client-side Storage upload call) and then
-- registers it via upload_proof().
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_path text;
  v_status public.content_moderation_status;
begin
  v_path := current_setting('test.bet_id') || '/proof.jpg';
  perform set_config('test.proof_path', v_path, false);

  insert into storage.objects (bucket_id, name, owner)
  values ('proof-assets', v_path, 'aaaaaaaa-0000-0000-0000-000000000001');

  select moderation_status into v_status from public.upload_proof(
    current_setting('test.bet_id')::uuid, v_path, 'image/jpeg', 250000, 'the sink, spotless'
  );
  if v_status <> 'approved' then
    raise exception 'FAIL: expected a clean proof upload to be approved, got %', v_status;
  end if;
  raise notice 'PASS: a bet participant can upload and register proof';
end;
$$;

-- An oversized file is rejected.
do $$
begin
  begin
    perform public.upload_proof(current_setting('test.bet_id')::uuid, current_setting('test.proof_path'), 'image/jpeg', 99999999, null);
    raise exception 'FAIL: expected an oversized image to be rejected';
  exception
    when others then
      if sqlerrm not like '%between 1 byte and 10MB%' then
        raise;
      end if;
      raise notice 'PASS: an oversized image is rejected';
  end;
end;
$$;

-- An unsupported MIME type is rejected.
do $$
begin
  begin
    perform public.upload_proof(current_setting('test.bet_id')::uuid, current_setting('test.proof_path'), 'application/pdf', 1000, null);
    raise exception 'FAIL: expected an unsupported mime type to be rejected';
  exception
    when others then
      if sqlerrm not like '%unsupported image type%' then
        raise;
      end if;
      raise notice 'PASS: an unsupported MIME type is rejected';
  end;
end;
$$;

-- A path outside this bet's folder is rejected, even for a real participant.
do $$
begin
  begin
    perform public.upload_proof(current_setting('test.bet_id')::uuid, '00000000-0000-0000-0000-000000000099/sneaky.jpg', 'image/jpeg', 1000, null);
    raise exception 'FAIL: expected a mismatched storage path to be rejected';
  exception
    when others then
      if sqlerrm not like '%must be scoped to this bet%' then
        raise;
      end if;
      raise notice 'PASS: a storage path outside the bet''s own folder is rejected';
  end;
end;
$$;

-- Bob (also a participant) can see the proof.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.proof_assets where bet_id = current_setting('test.bet_id')::uuid;
  if v_count <> 1 then
    raise exception 'FAIL: expected bob to see 1 proof asset, saw %', v_count;
  end if;

  select count(*) into v_count from storage.objects
  where bucket_id = 'proof-assets' and name = current_setting('test.proof_path');
  if v_count <> 1 then
    raise exception 'FAIL: expected bob to see the storage object itself, saw %', v_count;
  end if;
  raise notice 'PASS: a fellow bet participant can see the proof metadata and storage object';
end;
$$;

-- Carol (uninvolved) cannot see the proof metadata or the storage object.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.proof_assets where bet_id = current_setting('test.bet_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 proof assets, saw %', v_count;
  end if;

  select count(*) into v_count from storage.objects
  where bucket_id = 'proof-assets' and name = current_setting('test.proof_path');
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 storage objects, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see the proof metadata or storage object';
end;
$$;

-- Direct insert into proof_assets is denied -- must use the RPC.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    insert into public.proof_assets (bet_id, uploader_id, storage_path, mime_type, size_bytes)
    values (current_setting('test.bet_id')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'sneaky/path.jpg', 'image/jpeg', 1000);
    raise exception 'FAIL: expected direct insert into proof_assets to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into proof_assets denied, must use the RPC';
  end;
end;
$$;

-- anon has no table-level access to proof_assets at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.proof_assets limit 1;
    raise exception 'FAIL: expected anon SELECT on proof_assets to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to proof_assets';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'proof_assets.test.sql: all assertions passed';
end;
$$;
