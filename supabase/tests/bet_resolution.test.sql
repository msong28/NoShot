-- Behaviour test for bet result submission and dispute resolution
-- (Milestone 8). Same convention as bets_core.test.sql: must ERROR on any
-- failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'), -- carol (judge / group member)
  ('dddddddd-0000-0000-0000-000000000004'), -- dave (uninvolved)
  ('eeeeeeee-0000-0000-0000-000000000005'); -- eve (group member)

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
  ),
  (
    'eeeeeeee-0000-0000-0000-000000000005',
    'eve',
    'Eve',
    1995,
    now()
  );

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Set up an active participant_submission bet between alice and bob.
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

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.bet_id')::uuid, 1, 'approved');
end;
$$;

-- Carol (uninvolved) cannot submit a result for a bet she's not part of.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.submit_bet_result(current_setting('test.bet_id')::uuid, 'alice_wins', null);
    raise exception 'FAIL: expected an uninvolved user to be rejected';
  exception
    when others then
      if sqlerrm not like '%only a participant can submit%' then raise; end if;
      raise notice 'PASS: an uninvolved user cannot submit a result';
  end;
end;
$$;

-- Alice submits alice_wins; the bet goes to pending_result.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.bet_status;
  v_submission_id uuid;
begin
  select status into v_status from public.submit_bet_result(current_setting('test.bet_id')::uuid, 'alice_wins', 'I won');
  if v_status <> 'pending_result' then
    raise exception 'FAIL: expected pending_result, got %', v_status;
  end if;

  select id into v_submission_id from public.bet_result_submissions
  where bet_id = current_setting('test.bet_id')::uuid and submitter_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform set_config('test.submission_id', v_submission_id::text, false);
  raise notice 'PASS: alice submitted a result and the bet is pending confirmation';
end;
$$;

-- Direct table insert must be denied -- only the functions may write.
do $$
begin
  begin
    insert into public.bet_result_submissions (bet_id, submitter_id, proposed_outcome_key)
    values (current_setting('test.bet_id')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'alice_wins');
    raise exception 'FAIL: expected direct insert into bet_result_submissions to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into bet_result_submissions denied, must use the RPC';
  end;
end;
$$;

-- Bob confirms alice's submission; unanimous confirmation resolves the bet.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.bet_status;
  v_outcome text;
begin
  select status, resolved_outcome_key into v_status, v_outcome
  from public.confirm_bet_result(current_setting('test.bet_id')::uuid, current_setting('test.submission_id')::uuid, 'approved');
  if v_status <> 'resolved' or v_outcome <> 'alice_wins' then
    raise exception 'FAIL: expected resolved/alice_wins, got % / %', v_status, v_outcome;
  end if;
  raise notice 'PASS: unanimous confirmation resolves the bet with the right outcome';
end;
$$;

-- Bob cannot confirm again once resolved.
do $$
begin
  begin
    perform public.confirm_bet_result(current_setting('test.bet_id')::uuid, current_setting('test.submission_id')::uuid, 'approved');
    raise exception 'FAIL: expected confirming a resolved bet to be rejected';
  exception
    when others then
      if sqlerrm not like '%no result awaiting confirmation%' then raise; end if;
      raise notice 'PASS: cannot confirm a result once the bet is resolved';
  end;
end;
$$;

-- A fresh bet where alice and bob submit conflicting outcomes -> disputed,
-- then they converge on the same submission -> resolves without a fallback.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Race you there', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.dispute_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.dispute_bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.dispute_bet_id')::uuid, 'bob_wins', null);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.bet_status;
  v_alice_submission_id uuid;
begin
  select status into v_status from public.submit_bet_result(current_setting('test.dispute_bet_id')::uuid, 'alice_wins', null);
  if v_status <> 'disputed' then
    raise exception 'FAIL: expected disputed on conflicting submissions, got %', v_status;
  end if;

  select id into v_alice_submission_id from public.bet_result_submissions
  where bet_id = current_setting('test.dispute_bet_id')::uuid and submitter_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform set_config('test.alice_submission_id', v_alice_submission_id::text, false);
  raise notice 'PASS: conflicting submissions put the bet into disputed status';
end;
$$;

-- Alice (who disagreed) confirms bob's original submission instead --
-- agreement resolves the dispute without any fallback.
do $$
declare
  v_bob_submission_id uuid;
  v_status public.bet_status;
begin
  select id into v_bob_submission_id from public.bet_result_submissions
  where bet_id = current_setting('test.dispute_bet_id')::uuid and submitter_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  select status into v_status from public.confirm_bet_result(current_setting('test.dispute_bet_id')::uuid, v_bob_submission_id, 'approved');
  if v_status <> 'resolved' then
    raise exception 'FAIL: expected converging confirmations to resolve the dispute, got %', v_status;
  end if;
  raise notice 'PASS: a disputed bet resolves once affected participants converge on one submission';
end;
$$;

-- A judge-resolution bet: carol is the judge. Dispute, then only carol can resolve it.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Judged bet', '', null, 'judge', 'cccccccc-0000-0000-0000-000000000003', false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.judge_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.judge_bet_id')::uuid, 1, 'approved');
end;
$$;

-- The judge submits and, since only one submission exists, the bet goes
-- pending_result rather than disputed -- force a real dispute by having
-- carol submit two different outcomes isn't possible (one submission per
-- call), so instead alice tries to submit her own competing claim to
-- create a genuine conflict for the judge to resolve.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  perform public.submit_bet_result(current_setting('test.judge_bet_id')::uuid, 'bob_wins', null);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.submit_bet_result(current_setting('test.judge_bet_id')::uuid, 'alice_wins', null);
    raise exception 'FAIL: expected a non-judge to be rejected on a judge-method bet';
  exception
    when others then
      if sqlerrm not like '%only the designated judge%' then raise; end if;
      raise notice 'PASS: only the designated judge can submit a result on a judge-method bet';
  end;
end;
$$;

-- There's no dispute yet -- only carol's single submission exists (the
-- bet is pending_result) -- so resolve_dispute correctly refuses to act.
do $$
begin
  begin
    perform public.resolve_dispute(current_setting('test.judge_bet_id')::uuid, 'bob_wins');
    raise exception 'FAIL: expected resolving a non-disputed bet to be rejected';
  exception
    when others then
      if sqlerrm not like '%not disputed%' then raise; end if;
      raise notice 'PASS: cannot resolve a dispute on a bet that is not disputed';
  end;
end;
$$;

-- Since only the judge may submit at all under the judge method, the only
-- way a real dispute arises is the judge submitting a second, different
-- outcome (e.g. changing their mind) -- that's a genuine conflict between
-- two submissions, same as any other dispute.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.submit_bet_result(current_setting('test.judge_bet_id')::uuid, 'alice_wins', null);
  if v_status <> 'disputed' then
    raise exception 'FAIL: expected the judge''s own conflicting submission to dispute the bet, got %', v_status;
  end if;
  raise notice 'PASS: a judge submitting a second, different outcome disputes the bet';
end;
$$;

-- Carol (the judge) resolves it directly, bypassing confirmation, since
-- judge-method bets are decided by the judge's own authority.

do $$
declare
  v_status public.bet_status;
  v_outcome text;
begin
  select status, resolved_outcome_key into v_status, v_outcome
  from public.resolve_dispute(current_setting('test.judge_bet_id')::uuid, 'bob_wins');
  if v_status <> 'resolved' or v_outcome <> 'bob_wins' then
    raise exception 'FAIL: expected resolved/bob_wins, got % / %', v_status, v_outcome;
  end if;
  raise notice 'PASS: judge-method bet requires unanimous confirmation OR the judge to decide -- confirmed judge path works';
end;
$$;

-- A group-vote bet: alice, bob, and carol are all in the group. A conflict,
-- then all three vote and the majority outcome wins.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_group_id uuid;
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_group_id from public.create_group('Vote Group');
  perform public.invite_to_group(v_group_id, 'bbbbbbbb-0000-0000-0000-000000000002');
  perform public.invite_to_group(v_group_id, 'cccccccc-0000-0000-0000-000000000003');
  perform set_config('test.vote_group_id', v_group_id::text, false);

  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, v_group_id, 'Group voted bet', '', null, 'group_vote', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.vote_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.respond_to_group_invite(current_setting('test.vote_group_id')::uuid, true);
  perform public.approve_bet_version(current_setting('test.vote_bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.vote_bet_id')::uuid, 'bob_wins', null);
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  perform public.respond_to_group_invite(current_setting('test.vote_group_id')::uuid, true);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status from public.submit_bet_result(current_setting('test.vote_bet_id')::uuid, 'alice_wins', null);
  if v_status <> 'disputed' then
    raise exception 'FAIL: expected the group-vote bet to be disputed, got %', v_status;
  end if;
end;
$$;

-- Two of three votes for bob_wins should win the majority once all have voted.
do $$
begin
  perform public.vote_on_dispute(current_setting('test.vote_bet_id')::uuid, 'alice_wins');
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.vote_on_dispute(current_setting('test.vote_bet_id')::uuid, 'bob_wins');
end;
$$;

set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_status public.bet_status;
  v_outcome text;
begin
  select status, resolved_outcome_key into v_status, v_outcome
  from public.vote_on_dispute(current_setting('test.vote_bet_id')::uuid, 'bob_wins');
  if v_status <> 'resolved' or v_outcome <> 'bob_wins' then
    raise exception 'FAIL: expected the majority vote (bob_wins) to resolve the bet, got % / %', v_status, v_outcome;
  end if;
  raise notice 'PASS: group vote resolves once all active members have voted, majority wins';
end;
$$;

-- A random-fallback-enabled bet: dispute it, trigger the fallback, and
-- confirm the selected outcome is one of the ones actually submitted.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Random fallback bet', '', null, 'participant_submission', null, true,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.rand_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.approve_bet_version(current_setting('test.rand_bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.rand_bet_id')::uuid, 'bob_wins', null);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform public.submit_bet_result(current_setting('test.rand_bet_id')::uuid, 'alice_wins', null);
end;
$$;

do $$
declare
  v_status public.bet_status;
  v_outcome text;
begin
  select status, resolved_outcome_key into v_status, v_outcome
  from public.trigger_random_fallback(current_setting('test.rand_bet_id')::uuid);
  if v_status <> 'resolved' or v_outcome not in ('alice_wins', 'bob_wins') then
    raise exception 'FAIL: expected the random fallback to resolve to a submitted outcome, got % / %', v_status, v_outcome;
  end if;
  raise notice 'PASS: random fallback resolves to one of the submitted outcomes';
end;
$$;

-- A tie: unanimous confirmation on a 'tie' submission moves the bet to tied.
do $$
declare
  v_meal_id uuid;
  v_bet_id uuid;
  v_submission_id uuid;
begin
  select id into v_meal_id from public.currencies where name = 'Meal';
  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Tie test bet', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_meal_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );
  perform set_config('test.tie_bet_id', v_bet_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_submission_id uuid;
begin
  perform public.approve_bet_version(current_setting('test.tie_bet_id')::uuid, 1, 'approved');
  perform public.submit_bet_result(current_setting('test.tie_bet_id')::uuid, 'tie', null);

  select id into v_submission_id from public.bet_result_submissions
  where bet_id = current_setting('test.tie_bet_id')::uuid and submitter_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  perform set_config('test.tie_submission_id', v_submission_id::text, false);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.bet_status;
begin
  select status into v_status
  from public.confirm_bet_result(current_setting('test.tie_bet_id')::uuid, current_setting('test.tie_submission_id')::uuid, 'approved');
  if v_status <> 'tied' then
    raise exception 'FAIL: expected tied, got %', v_status;
  end if;
  raise notice 'PASS: a unanimously confirmed tie moves the bet to tied, not resolved';
end;
$$;

-- Dave (uninvolved) cannot see any of this.
set
  request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.bet_result_submissions
  where bet_id = current_setting('test.bet_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected an uninvolved user to see 0 result submissions, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see result submissions';
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.bet_result_submissions limit 1;
    raise exception 'FAIL: expected anon SELECT on bet_result_submissions to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to bet_result_submissions';
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from public.dispute_resolutions limit 1;
    raise exception 'FAIL: expected anon SELECT on dispute_resolutions to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to dispute_resolutions';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'bet_resolution.test.sql: all assertions passed';
end;
$$;
