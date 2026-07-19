-- Behaviour test for reports (Milestone 13 / MOD-01). Same convention as
-- the other behaviour tests: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'), -- carol (reporter)
  ('dddddddd-0000-0000-0000-000000000004'); -- dave (admin)

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
    1990,
    now()
  );

-- Dave is granted admin out-of-band -- the only way admin_users ever gets a
-- row (§ same as every other fixture-level direct insert here, run before
-- the role switch below with elevated privileges).
insert into
  public.admin_users (user_id)
values
  ('dddddddd-0000-0000-0000-000000000004');

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice sets up one of each reportable surface: a bet, a comment on it, a
-- group with a chat message, and a proof upload. The built-in 'Meal'
-- currency stands in for the currency surface.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
  v_group_id uuid;
  v_comment_id uuid;
  v_chat_message_id uuid;
  v_proof_path text;
  v_proof_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  perform set_config('test.currency_id', v_meal_id::text, false);

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Dishes tonight', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.bet_id', v_bet_id::text, false);

  select id into v_comment_id from public.post_comment(v_bet_id, 'a normal comment');
  perform set_config('test.comment_id', v_comment_id::text, false);

  select id into v_group_id from public.create_group('Test Roommates');
  select id into v_chat_message_id from public.post_chat_message(v_group_id, 'a normal message');
  perform set_config('test.chat_message_id', v_chat_message_id::text, false);

  v_proof_path := v_bet_id || '/proof.jpg';
  insert into storage.objects (bucket_id, name, owner)
  values ('proof-assets', v_proof_path, 'aaaaaaaa-0000-0000-0000-000000000001');
  select id into v_proof_id from public.upload_proof(v_bet_id, v_proof_path, 'image/jpeg', 250000, null);
  perform set_config('test.proof_asset_id', v_proof_id::text, false);
end;
$$;

-- Carol reports all 6 surfaces.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_status public.report_status;
begin
  select status into v_status from public.submit_report('bet', current_setting('test.bet_id')::uuid, 'spam', null);
  if v_status <> 'open' then raise exception 'FAIL: expected a new bet report to be open, got %', v_status; end if;

  select status into v_status from public.submit_report('currency', current_setting('test.currency_id')::uuid, 'inappropriate_content', 'looks off');
  if v_status <> 'open' then raise exception 'FAIL: expected a new currency report to be open, got %', v_status; end if;

  select status into v_status from public.submit_report('comment', current_setting('test.comment_id')::uuid, 'harassment', null);
  if v_status <> 'open' then raise exception 'FAIL: expected a new comment report to be open, got %', v_status; end if;

  select status into v_status from public.submit_report('chat_message', current_setting('test.chat_message_id')::uuid, 'harassment', null);
  if v_status <> 'open' then raise exception 'FAIL: expected a new chat_message report to be open, got %', v_status; end if;

  select status into v_status from public.submit_report('proof_asset', current_setting('test.proof_asset_id')::uuid, 'inappropriate_content', null);
  if v_status <> 'open' then raise exception 'FAIL: expected a new proof_asset report to be open, got %', v_status; end if;

  select status into v_status from public.submit_report('user', 'bbbbbbbb-0000-0000-0000-000000000002', 'scam_fraud', 'suspicious behaviour');
  if v_status <> 'open' then raise exception 'FAIL: expected a new user report to be open, got %', v_status; end if;

  raise notice 'PASS: a report can be submitted against all 6 reportable surfaces';
end;
$$;

-- A report against a nonexistent row is rejected.
do $$
begin
  begin
    perform public.submit_report('bet', '00000000-0000-0000-0000-000000000099', 'spam', null);
    raise exception 'FAIL: expected a report against a nonexistent bet to be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer exists%' then raise; end if;
      raise notice 'PASS: a report against a nonexistent target is rejected';
  end;
end;
$$;

-- details over 1000 characters is rejected.
do $$
begin
  begin
    perform public.submit_report('bet', current_setting('test.bet_id')::uuid, 'other', repeat('x', 1001));
    raise exception 'FAIL: expected overlong details to be rejected';
  exception
    when others then
      if sqlerrm not like '%1000 characters%' then raise; end if;
      raise notice 'PASS: report details over 1000 characters is rejected';
  end;
end;
$$;

-- Direct table insert must be denied -- only the RPC may write.
do $$
begin
  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('cccccccc-0000-0000-0000-000000000003', 'bet', current_setting('test.bet_id')::uuid, 'spam');
    raise exception 'FAIL: expected direct insert into reports to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into reports denied, must use the RPC';
  end;
end;
$$;

-- Bob (not the reporter, not an admin) sees none of carol's reports.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
  v_is_admin boolean;
begin
  select count(*) into v_count from public.reports;
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved non-admin to see 0 reports, saw %', v_count;
  end if;

  select public.is_admin() into v_is_admin;
  if v_is_admin then
    raise exception 'FAIL: expected bob to not be an admin';
  end if;
  raise notice 'PASS: a non-admin, non-reporter sees no reports and is_admin() is false';
end;
$$;

-- Carol sees her own 6 reports. (Uses carol's literal id rather than
-- auth.uid() in the raw SELECT itself -- see account_deletion.test.sql's
-- note on why a bare top-level statement can't call auth.uid() directly.)
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.reports
  where reporter_id = 'cccccccc-0000-0000-0000-000000000003';
  if v_count <> 6 then
    raise exception 'FAIL: expected carol to see her own 6 reports, saw %', v_count;
  end if;
  raise notice 'PASS: a reporter sees their own submitted reports';
end;
$$;

-- Dave (admin) sees all 6 reports, and is_admin() is true.
set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  v_count integer;
  v_is_admin boolean;
begin
  select public.is_admin() into v_is_admin;
  if not v_is_admin then
    raise exception 'FAIL: expected dave to be an admin';
  end if;

  select count(*) into v_count from public.reports;
  if v_count <> 6 then
    raise exception 'FAIL: expected the admin to see all 6 reports, saw %', v_count;
  end if;
  raise notice 'PASS: an admin sees every report regardless of who filed it';
end;
$$;

-- admin_users grants nothing to authenticated, admin or not -- only
-- is_admin() may read it.
do $$
begin
  begin
    perform 1 from public.admin_users limit 1;
    raise exception 'FAIL: expected direct SELECT on admin_users to be denied even for an admin';
  exception
    when insufficient_privilege then
      raise notice 'PASS: admin_users has no direct client access, not even for an admin';
  end;
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.reports limit 1;
    raise exception 'FAIL: expected anon SELECT on reports to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to reports';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.admin_users limit 1;
    raise exception 'FAIL: expected anon SELECT on admin_users to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to admin_users';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'reports.test.sql: all assertions passed';
end;
$$;
