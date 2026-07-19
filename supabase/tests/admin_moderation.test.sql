-- Behaviour test for the admin dashboard actions & audit log (Milestone 13
-- / MOD-05, MOD-06). Same convention as the other behaviour tests: must
-- ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob (comment/message/proof author)
  ('cccccccc-0000-0000-0000-000000000003'), -- carol (reporter, not an admin)
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

insert into
  public.admin_users (user_id)
values
  ('dddddddd-0000-0000-0000-000000000004');

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice and Bob set up one of each removable content type, a bet, and a
-- group-owned currency (no individual owner) to exercise every branch.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
  v_group_id uuid;
  v_comment_id uuid;
  v_chat_message_id uuid;
  v_proof_path text;
  v_proof_id uuid;
  v_group_currency_id uuid;
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

  select id into v_group_id from public.create_group('Test Roommates');
  insert into public.currencies (name, category, group_id)
  values ('House Points', 'custom', v_group_id)
  returning id into v_group_currency_id;
  perform set_config('test.group_currency_id', v_group_currency_id::text, false);

  perform set_config('test.alice_id', 'aaaaaaaa-0000-0000-0000-000000000001', false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_comment_id uuid;
  v_group_id uuid;
  v_chat_message_id uuid;
  v_proof_path text;
  v_proof_id uuid;
begin
  select id into v_comment_id from public.post_comment(current_setting('test.bet_id')::uuid, 'a normal comment');
  perform set_config('test.comment_id', v_comment_id::text, false);

  select id into v_group_id from public.create_group('Bob''s group');
  select id into v_chat_message_id from public.post_chat_message(v_group_id, 'a normal message');
  perform set_config('test.chat_message_id', v_chat_message_id::text, false);

  v_proof_path := current_setting('test.bet_id') || '/proof.jpg';
  insert into storage.objects (bucket_id, name, owner)
  values ('proof-assets', v_proof_path, 'bbbbbbbb-0000-0000-0000-000000000002');
  select id into v_proof_id from public.upload_proof(
    current_setting('test.bet_id')::uuid, v_proof_path, 'image/jpeg', 250000, null
  );
  perform set_config('test.proof_asset_id', v_proof_id::text, false);
end;
$$;

-- Carol reports each surface.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_id uuid;
begin
  select id into v_id from public.submit_report('comment', current_setting('test.comment_id')::uuid, 'harassment', null);
  perform set_config('test.comment_report_id', v_id::text, false);

  select id into v_id from public.submit_report('chat_message', current_setting('test.chat_message_id')::uuid, 'harassment', null);
  perform set_config('test.chat_report_id', v_id::text, false);

  select id into v_id from public.submit_report('proof_asset', current_setting('test.proof_asset_id')::uuid, 'inappropriate_content', null);
  perform set_config('test.proof_report_id', v_id::text, false);

  select id into v_id from public.submit_report('currency', current_setting('test.group_currency_id')::uuid, 'spam', null);
  perform set_config('test.group_currency_report_id', v_id::text, false);

  select id into v_id from public.submit_report('bet', current_setting('test.bet_id')::uuid, 'spam', null);
  perform set_config('test.bet_report_id', v_id::text, false);

  select id into v_id from public.submit_report('user', 'bbbbbbbb-0000-0000-0000-000000000002', 'scam_fraud', null);
  perform set_config('test.user_report_id', v_id::text, false);
end;
$$;

-- Carol (not an admin) cannot use any admin action.
do $$
begin
  begin
    perform public.admin_remove_content(current_setting('test.comment_report_id')::uuid, null);
    raise exception 'FAIL: expected a non-admin to be rejected from admin_remove_content';
  exception
    when others then
      if sqlerrm not like '%admin access required%' then raise; end if;
      raise notice 'PASS: a non-admin cannot call admin_remove_content';
  end;

  begin
    perform public.admin_suspend_user(current_setting('test.user_report_id')::uuid, null);
    raise exception 'FAIL: expected a non-admin to be rejected from admin_suspend_user';
  exception
    when others then
      if sqlerrm not like '%admin access required%' then raise; end if;
      raise notice 'PASS: a non-admin cannot call admin_suspend_user';
  end;

  begin
    perform public.admin_resolve_report(current_setting('test.comment_report_id')::uuid, null);
    raise exception 'FAIL: expected a non-admin to be rejected from admin_resolve_report';
  exception
    when others then
      if sqlerrm not like '%admin access required%' then raise; end if;
      raise notice 'PASS: a non-admin cannot call admin_resolve_report';
  end;

  begin
    perform public.admin_dismiss_report(current_setting('test.comment_report_id')::uuid, null);
    raise exception 'FAIL: expected a non-admin to be rejected from admin_dismiss_report';
  exception
    when others then
      if sqlerrm not like '%admin access required%' then raise; end if;
      raise notice 'PASS: a non-admin cannot call admin_dismiss_report';
  end;

  begin
    perform public.get_report_evidence(current_setting('test.comment_report_id')::uuid);
    raise exception 'FAIL: expected a non-admin to be rejected from get_report_evidence';
  exception
    when others then
      if sqlerrm not like '%admin access required%' then raise; end if;
      raise notice 'PASS: a non-admin cannot call get_report_evidence';
  end;
end;
$$;

-- Dave (admin) reviews evidence, bypassing the target tables' own RLS (Dave
-- is not a participant of the bet or a member of Bob's group).
set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  v_evidence jsonb;
begin
  select public.get_report_evidence(current_setting('test.comment_report_id')::uuid) into v_evidence;
  if v_evidence->>'body' <> 'a normal comment' then
    raise exception 'FAIL: expected evidence body to match the comment, got %', v_evidence;
  end if;
  raise notice 'PASS: an admin can view evidence for content they have no other access to';
end;
$$;

-- Removing content: comment, chat_message, proof_asset, currency all
-- succeed and are audit-logged; bet and user are rejected.
-- Verified via get_report_evidence() rather than a raw table SELECT --
-- dave has no ordinary RLS visibility into a bet he's not part of or a
-- group he's not a member of, so a direct SELECT as dave would see nothing
-- regardless of whether the removal worked; the evidence RPC is the
-- admin's actual read path (its own RLS-bypass is covered above).
do $$
declare
  v_evidence jsonb;
  v_action_type public.moderation_action_type;
begin
  select public.get_report_evidence(current_setting('test.comment_report_id')::uuid) into v_evidence;
  if v_evidence->>'removed_at' is not null then
    raise exception 'FAIL: comment should not be removed yet';
  end if;

  select action_type into v_action_type from public.admin_remove_content(current_setting('test.comment_report_id')::uuid, 'cleared, was spam');
  if v_action_type <> 'remove_content' then
    raise exception 'FAIL: expected remove_content action_type, got %', v_action_type;
  end if;

  select public.get_report_evidence(current_setting('test.comment_report_id')::uuid) into v_evidence;
  if v_evidence->>'moderation_status' <> 'blocked' or v_evidence->>'removed_at' is null then
    raise exception 'FAIL: expected the comment to be blocked and removed, got %', v_evidence;
  end if;
  raise notice 'PASS: admin_remove_content blocks and removes a comment';
end;
$$;

do $$
declare
  v_evidence jsonb;
begin
  perform public.admin_remove_content(current_setting('test.chat_report_id')::uuid, null);
  select public.get_report_evidence(current_setting('test.chat_report_id')::uuid) into v_evidence;
  if v_evidence->>'moderation_status' <> 'blocked' then
    raise exception 'FAIL: expected the chat message to be blocked, got %', v_evidence;
  end if;
  raise notice 'PASS: admin_remove_content blocks a chat message';
end;
$$;

do $$
declare
  v_evidence jsonb;
begin
  perform public.admin_remove_content(current_setting('test.proof_report_id')::uuid, null);
  select public.get_report_evidence(current_setting('test.proof_report_id')::uuid) into v_evidence;
  if v_evidence->>'moderation_status' <> 'blocked' then
    raise exception 'FAIL: expected the proof asset to be blocked, got %', v_evidence;
  end if;
  raise notice 'PASS: admin_remove_content blocks a proof asset';
end;
$$;

do $$
declare
  v_evidence jsonb;
begin
  perform public.admin_remove_content(current_setting('test.group_currency_report_id')::uuid, null);
  select public.get_report_evidence(current_setting('test.group_currency_report_id')::uuid) into v_evidence;
  if v_evidence->>'moderation_status' <> 'blocked' then
    raise exception 'FAIL: expected the currency to be blocked, got %', v_evidence;
  end if;
  raise notice 'PASS: admin_remove_content blocks a currency';
end;
$$;

do $$
begin
  begin
    perform public.admin_remove_content(current_setting('test.bet_report_id')::uuid, null);
    raise exception 'FAIL: expected content removal on a bet report to be rejected';
  exception
    when others then
      if sqlerrm not like '%isn''t supported for this report type%' then raise; end if;
      raise notice 'PASS: admin_remove_content rejects a bet target';
  end;

  begin
    perform public.admin_remove_content(current_setting('test.user_report_id')::uuid, null);
    raise exception 'FAIL: expected content removal on a user report to be rejected';
  exception
    when others then
      if sqlerrm not like '%isn''t supported for this report type%' then raise; end if;
      raise notice 'PASS: admin_remove_content rejects a user target';
  end;
end;
$$;

-- Suspending: a 'user' report suspends the target directly; a
-- content-type report suspends the responsible author. Verified via
-- get_report_evidence() -- dave has no ordinary RLS visibility into bob's
-- profile (profiles_select_own is own-row-only), same reasoning as the
-- content-removal checks above.
do $$
declare
  v_evidence jsonb;
begin
  perform public.admin_suspend_user(current_setting('test.user_report_id')::uuid, 'repeated scam reports');
  select public.get_report_evidence(current_setting('test.user_report_id')::uuid) into v_evidence;
  if v_evidence->>'status' <> 'suspended' then
    raise exception 'FAIL: expected bob to be suspended, got %', v_evidence;
  end if;
  raise notice 'PASS: admin_suspend_user suspends the reported user directly';
end;
$$;

do $$
begin
  begin
    perform public.admin_suspend_user(current_setting('test.group_currency_report_id')::uuid, null);
    raise exception 'FAIL: expected suspending over a group-owned currency (no individual owner) to be rejected';
  exception
    when others then
      if sqlerrm not like '%no individual user is responsible%' then raise; end if;
      raise notice 'PASS: admin_suspend_user rejects a target with no individually responsible user';
  end;
end;
$$;

-- Resolving and dismissing.
do $$
declare
  v_report public.reports;
begin
  select * into v_report from public.admin_resolve_report(current_setting('test.comment_report_id')::uuid, 'handled');
  if v_report.status <> 'resolved' or v_report.resolved_at is null or v_report.resolved_by <> 'dddddddd-0000-0000-0000-000000000004' then
    raise exception 'FAIL: expected the comment report to be resolved by dave, got %', row_to_json(v_report);
  end if;
  raise notice 'PASS: admin_resolve_report resolves an open report';
end;
$$;

do $$
begin
  begin
    perform public.admin_resolve_report(current_setting('test.comment_report_id')::uuid, null);
    raise exception 'FAIL: expected resolving an already-resolved report to be rejected';
  exception
    when others then
      if sqlerrm not like '%no open report found%' then raise; end if;
      raise notice 'PASS: a report cannot be resolved twice';
  end;
end;
$$;

do $$
declare
  v_report public.reports;
begin
  select * into v_report from public.admin_dismiss_report(current_setting('test.bet_report_id')::uuid, 'not actually spam');
  if v_report.status <> 'dismissed' or v_report.resolved_at is null then
    raise exception 'FAIL: expected the bet report to be dismissed, got %', row_to_json(v_report);
  end if;
  raise notice 'PASS: admin_dismiss_report dismisses an open report';
end;
$$;

-- Every action above wrote exactly one moderation_actions row.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.moderation_actions where admin_id = 'dddddddd-0000-0000-0000-000000000004';
  if v_count <> 7 then
    raise exception 'FAIL: expected 7 audit-logged admin actions (4 removals + 1 suspension + resolve + dismiss), saw %', v_count;
  end if;
  raise notice 'PASS: every admin action wrote a moderation_actions row';
end;
$$;

-- moderation_actions is append-only: authenticated has no UPDATE/DELETE
-- grant at all, so even an admin cannot mutate it directly, only insert
-- via the RPCs above (matches ledger_entries' own test convention).
do $$
begin
  begin
    update public.moderation_actions set note = 'tampered' where admin_id = 'dddddddd-0000-0000-0000-000000000004';
    raise exception 'FAIL: expected updating a moderation_actions row to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: moderation_actions rows cannot be updated';
  end;

  begin
    delete from public.moderation_actions where admin_id = 'dddddddd-0000-0000-0000-000000000004';
    raise exception 'FAIL: expected deleting a moderation_actions row to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: moderation_actions rows cannot be deleted';
  end;
end;
$$;

-- A report whose target has since been deleted returns a clear error, not
-- a null/empty jsonb blob.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_stale_report_id uuid;
begin
  select id into v_stale_report_id from public.submit_report(
    'proof_asset', current_setting('test.proof_asset_id')::uuid, 'other', null
  );
  perform set_config('test.stale_report_id', v_stale_report_id::text, false);
end;
$$;

reset role;

delete from public.proof_assets where id = current_setting('test.proof_asset_id')::uuid;

set role authenticated;

set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
begin
  begin
    perform public.get_report_evidence(current_setting('test.stale_report_id')::uuid);
    raise exception 'FAIL: expected evidence for a deleted target to be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer exists%' then raise; end if;
      raise notice 'PASS: evidence for a since-deleted target raises a clear error';
  end;
end;
$$;

-- Bob, now suspended, is unaffected in his ability to read his own profile
-- -- this milestone only marks the status, MOD-02 (out of scope) is what
-- would actually enforce it elsewhere.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.profile_status;
begin
  select status into v_status from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if v_status <> 'suspended' then
    raise exception 'FAIL: expected bob to see his own suspended status, got %', v_status;
  end if;
  raise notice 'PASS: a suspended user''s own profile reflects the suspension';
end;
$$;

reset role;

do $$
begin
  raise notice 'admin_moderation.test.sql: all assertions passed';
end;
$$;
