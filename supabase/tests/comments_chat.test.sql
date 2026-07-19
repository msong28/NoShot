-- Behaviour test for comments & chat (Milestone 12 / SOC-01, SOC-02). Same
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
  v_group_id uuid;
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

  select id into v_group_id from public.create_group('Test Roommates');
  perform set_config('test.group_id', v_group_id::text, false);
end;
$$;

-- Only a participant can comment -- carol (uninvolved) is rejected.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.post_comment(current_setting('test.bet_id')::uuid, 'nice bet');
    raise exception 'FAIL: expected a non-participant to be rejected from commenting';
  exception
    when others then
      if sqlerrm not like '%only a participant can comment%' then
        raise;
      end if;
      raise notice 'PASS: only a bet participant can post a comment';
  end;
end;
$$;

-- Alice (a participant) comments successfully.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.content_moderation_status;
begin
  select moderation_status into v_status from public.post_comment(current_setting('test.bet_id')::uuid, 'Good luck!');
  if v_status <> 'approved' then
    raise exception 'FAIL: expected a clean comment to be approved, got %', v_status;
  end if;
  raise notice 'PASS: a bet participant can post a comment';
end;
$$;

-- A blocked-tier comment is rejected outright.
do $$
begin
  begin
    perform public.post_comment(current_setting('test.bet_id')::uuid, 'I will kill you over this bet');
    raise exception 'FAIL: expected a hard-block comment to be rejected';
  exception
    when others then
      if sqlerrm not like '%isn''t allowed%' then
        raise;
      end if;
      raise notice 'PASS: a hard-block-tier comment is rejected outright';
  end;
end;
$$;

-- A warn-tier comment is still posted, but queued for review.
do $$
declare
  v_status public.content_moderation_status;
begin
  select moderation_status into v_status from public.post_comment(current_setting('test.bet_id')::uuid, 'loser has to chug a whole bottle');
  if v_status <> 'pending_review' then
    raise exception 'FAIL: expected a warn-tier comment to be pending_review, got %', v_status;
  end if;
  raise notice 'PASS: a warn-tier comment is posted but queued for review';
end;
$$;

-- Carol (uninvolved, not in alice's group either) sees no comments at all.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.comments where bet_id = current_setting('test.bet_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 comments, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see a bet''s comments';
end;
$$;

-- Direct insert into comments is denied -- must use the RPC.
do $$
begin
  begin
    insert into public.comments (bet_id, author_id, body)
    values (current_setting('test.bet_id')::uuid, 'cccccccc-0000-0000-0000-000000000003', 'sneaky');
    raise exception 'FAIL: expected direct insert into comments to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into comments denied, must use the RPC';
  end;
end;
$$;

-- Group chat: only an active member can post.
do $$
begin
  begin
    perform public.post_chat_message(current_setting('test.group_id')::uuid, 'hi team');
    raise exception 'FAIL: expected a non-member to be rejected from posting to group chat';
  exception
    when others then
      if sqlerrm not like '%active member%' then
        raise;
      end if;
      raise notice 'PASS: only an active group member can post a chat message';
  end;
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.content_moderation_status;
begin
  select moderation_status into v_status from public.post_chat_message(current_setting('test.group_id')::uuid, 'hey everyone');
  if v_status <> 'approved' then
    raise exception 'FAIL: expected a clean chat message to be approved, got %', v_status;
  end if;
  raise notice 'PASS: an active group member can post a chat message';
end;
$$;

-- Carol (not a member of this group) sees no chat messages.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.chat_messages where group_id = current_setting('test.group_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected a non-member to see 0 chat messages, saw %', v_count;
  end if;
  raise notice 'PASS: a non-member cannot see a group''s chat messages';
end;
$$;

-- Direct insert into chat_messages is denied -- must use the RPC.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    insert into public.chat_messages (group_id, author_id, body)
    values (current_setting('test.group_id')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'sneaky');
    raise exception 'FAIL: expected direct insert into chat_messages to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into chat_messages denied, must use the RPC';
  end;
end;
$$;

-- anon has no table-level access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.comments limit 1;
    raise exception 'FAIL: expected anon SELECT on comments to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to comments';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.chat_messages limit 1;
    raise exception 'FAIL: expected anon SELECT on chat_messages to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to chat_messages';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'comments_chat.test.sql: all assertions passed';
end;
$$;
