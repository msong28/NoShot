-- Behaviour test for polls (Milestone 12 / SOC-03). Same convention as the
-- other behaviour tests: must ERROR on any failed assertion.
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

-- A single option is rejected -- a poll needs at least two.
do $$
begin
  begin
    perform public.create_poll(current_setting('test.bet_id')::uuid, null, 'Who wins?', array['Alice'], false);
    raise exception 'FAIL: expected a one-option poll to be rejected';
  exception
    when others then
      if sqlerrm not like '%at least two options%' then
        raise;
      end if;
      raise notice 'PASS: a poll needs at least two options';
  end;
end;
$$;

-- Alice (a participant) creates a bet-scoped poll.
do $$
declare
  v_poll_id uuid;
  v_option_count integer;
begin
  select id into v_poll_id from public.create_poll(
    current_setting('test.bet_id')::uuid, null, 'Who wins?', array['Alice', 'Bob'], false
  );
  perform set_config('test.poll_id', v_poll_id::text, false);

  select count(*) into v_option_count from public.poll_options where poll_id = v_poll_id;
  if v_option_count <> 2 then
    raise exception 'FAIL: expected 2 poll options, got %', v_option_count;
  end if;
  raise notice 'PASS: a bet participant can create a bet-scoped poll with its options';
end;
$$;

-- Carol (uninvolved) cannot create a poll on this bet.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.create_poll(current_setting('test.bet_id')::uuid, null, 'Sneaky poll', array['A', 'B'], false);
    raise exception 'FAIL: expected a non-participant to be rejected from creating a bet poll';
  exception
    when others then
      if sqlerrm not like '%only a participant can create a poll%' then
        raise;
      end if;
      raise notice 'PASS: only a bet participant can create a poll on that bet';
  end;

  -- ...and cannot see it either.
  declare
    v_count integer;
  begin
    select count(*) into v_count from public.polls where id = current_setting('test.poll_id')::uuid;
    if v_count <> 0 then
      raise exception 'FAIL: expected an uninvolved user to see 0 polls, saw %', v_count;
    end if;
    raise notice 'PASS: an uninvolved user cannot see a bet''s poll';
  end;
end;
$$;

-- Bob votes for "Bob" (single-choice poll).
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_bob_option_id uuid;
  v_count integer;
begin
  select id into v_bob_option_id from public.poll_options
  where poll_id = current_setting('test.poll_id')::uuid and label = 'Bob';
  perform set_config('test.bob_option_id', v_bob_option_id::text, false);

  perform public.vote_on_poll(current_setting('test.poll_id')::uuid, v_bob_option_id);

  select count(*) into v_count from public.poll_votes
  where poll_id = current_setting('test.poll_id')::uuid and voter_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if v_count <> 1 then
    raise exception 'FAIL: expected bob to have exactly 1 vote, got %', v_count;
  end if;
  raise notice 'PASS: a bet participant can vote on a poll';
end;
$$;

-- Bob changes his mind and votes for "Alice" instead -- single-choice
-- replaces the old vote rather than adding a second one.
do $$
declare
  v_alice_option_id uuid;
  v_count integer;
begin
  select id into v_alice_option_id from public.poll_options
  where poll_id = current_setting('test.poll_id')::uuid and label = 'Alice';

  perform public.vote_on_poll(current_setting('test.poll_id')::uuid, v_alice_option_id);

  select count(*) into v_count from public.poll_votes
  where poll_id = current_setting('test.poll_id')::uuid and voter_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if v_count <> 1 then
    raise exception 'FAIL: expected bob to still have exactly 1 vote after changing it, got %', v_count;
  end if;
  raise notice 'PASS: re-voting on a single-choice poll replaces the previous vote';
end;
$$;

-- Only the creator can close the poll.
do $$
begin
  begin
    perform public.close_poll(current_setting('test.poll_id')::uuid);
    raise exception 'FAIL: expected a non-creator to be rejected from closing the poll';
  exception
    when others then
      if sqlerrm not like '%no open poll found%' then
        raise;
      end if;
      raise notice 'PASS: only the poll creator can close it';
  end;
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_closed_at timestamptz;
begin
  select closed_at into v_closed_at from public.close_poll(current_setting('test.poll_id')::uuid);
  if v_closed_at is null then
    raise exception 'FAIL: expected the poll to be closed';
  end if;
  raise notice 'PASS: the poll creator can close it';
end;
$$;

-- Voting on a closed poll is rejected.
do $$
begin
  begin
    perform public.vote_on_poll(current_setting('test.poll_id')::uuid, current_setting('test.bob_option_id')::uuid);
    raise exception 'FAIL: expected voting on a closed poll to be rejected';
  exception
    when others then
      if sqlerrm not like '%closed%' then
        raise;
      end if;
      raise notice 'PASS: voting on a closed poll is rejected';
  end;
end;
$$;

-- Group-scoped poll: only an active member can create one, and a
-- multiple-choice poll lets the same voter pick more than one option.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.create_poll(null, current_setting('test.group_id')::uuid, 'Movie night?', array['A', 'B'], true);
    raise exception 'FAIL: expected a non-member to be rejected from creating a group poll';
  exception
    when others then
      if sqlerrm not like '%active member%' then
        raise;
      end if;
      raise notice 'PASS: only an active group member can create a group poll';
  end;
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_poll_id uuid;
  v_opt_a uuid;
  v_opt_b uuid;
  v_count integer;
begin
  select id into v_group_poll_id from public.create_poll(
    null, current_setting('test.group_id')::uuid, 'Movie night?', array['Option A', 'Option B'], true
  );

  select id into v_opt_a from public.poll_options where poll_id = v_group_poll_id and label = 'Option A';
  select id into v_opt_b from public.poll_options where poll_id = v_group_poll_id and label = 'Option B';

  perform public.vote_on_poll(v_group_poll_id, v_opt_a);
  perform public.vote_on_poll(v_group_poll_id, v_opt_b);

  select count(*) into v_count from public.poll_votes where poll_id = v_group_poll_id and voter_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 votes on a multi-choice poll, got %', v_count;
  end if;
  raise notice 'PASS: a multiple-choice poll allows voting for more than one option';
end;
$$;

-- Direct insert into polls is denied -- must use the RPC.
do $$
begin
  begin
    insert into public.polls (bet_id, creator_id, question)
    values (current_setting('test.bet_id')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'sneaky');
    raise exception 'FAIL: expected direct insert into polls to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into polls denied, must use the RPC';
  end;
end;
$$;

-- anon has no table-level access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.polls limit 1;
    raise exception 'FAIL: expected anon SELECT on polls to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to polls';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'polls.test.sql: all assertions passed';
end;
$$;
