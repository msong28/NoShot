-- Behaviour test for manual_obligation_proposals (Milestone 10). Same
-- convention as the other *.test.sql files: must ERROR on any failed
-- assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('cccccccc-0000-0000-0000-000000000003'); -- carol (uninvolved / non-friend)

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

-- Alice and Bob become friends (manual obligations require an accepted
-- friendship between the two parties).
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002');
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform public.respond_friend_request(
    (select id from public.friendships where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
    true
  );
end;
$$;

-- Stash the built-in "Meal" currency id (seeded by the currencies
-- migration) so every block below can reference it.
do $$
begin
  perform set_config('test.currency_id', (select id::text from public.currencies where name = 'Meal' and is_builtin), false);
end;
$$;

-- Alice proposes that Bob owes her for a meal. Lands as pending, with her
-- as the proposer.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_status public.manual_obligation_status;
  v_proposer uuid;
begin
  select status, proposer_id into v_status, v_proposer
  from public.propose_manual_obligation(
    'bbbbbbbb-0000-0000-0000-000000000002', -- debtor: bob
    'aaaaaaaa-0000-0000-0000-000000000001', -- creditor: alice
    current_setting('test.currency_id')::uuid,
    5.00,
    'Dinner last night'
  );

  if v_status <> 'pending' or v_proposer <> 'aaaaaaaa-0000-0000-0000-000000000001' then
    raise exception 'FAIL: expected a pending proposal from alice, got % / %', v_status, v_proposer;
  end if;
  perform set_config('test.proposal_id', (
    select id::text from public.manual_obligation_proposals
    where debtor_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'pending'
  ), false);
  raise notice 'PASS: alice proposed a manual obligation, pending bob''s approval';
end;
$$;

-- Direct table insert must be denied -- only the functions may write.
do $$
begin
  begin
    insert into public.manual_obligation_proposals (proposer_id, debtor_id, creditor_id, currency_id, amount, description)
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      current_setting('test.currency_id')::uuid,
      1.00,
      'sneaky'
    );
    raise exception 'FAIL: expected direct insert into manual_obligation_proposals to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct insert into manual_obligation_proposals denied, must use the RPC';
  end;
end;
$$;

-- Carol (uninvolved) cannot see the proposal.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.manual_obligation_proposals
  where id = current_setting('test.proposal_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL: expected carol to see 0 rows of a proposal she is not party to, saw %', v_count;
  end if;
  raise notice 'PASS: an uninvolved user cannot see a manual obligation proposal';
end;
$$;

-- Alice cannot approve her own proposal.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.approve_manual_obligation(current_setting('test.proposal_id')::uuid);
    raise exception 'FAIL: expected the proposer to be unable to approve their own proposal';
  exception
    when others then
      if sqlerrm not like '%no pending obligation proposal found%' then raise; end if;
      raise notice 'PASS: the proposer cannot approve their own proposal';
  end;
end;
$$;

-- Bob approves; the obligation becomes real (BAL-03: only after both approve).
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.manual_obligation_status;
begin
  select status into v_status
  from public.approve_manual_obligation(current_setting('test.proposal_id')::uuid);
  if v_status <> 'approved' then
    raise exception 'FAIL: expected bob''s approval to mark the obligation approved, got %', v_status;
  end if;
  raise notice 'PASS: bob approved the obligation, now approved';
end;
$$;

-- Approving an already-approved proposal fails.
do $$
begin
  begin
    perform public.approve_manual_obligation(current_setting('test.proposal_id')::uuid);
    raise exception 'FAIL: expected re-approving an already-approved proposal to be rejected';
  exception
    when others then
      if sqlerrm not like '%no pending obligation proposal found%' then raise; end if;
      raise notice 'PASS: cannot approve a proposal that is no longer pending';
  end;
end;
$$;

-- Decline path: alice proposes again, bob declines this time.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform set_config('test.decline_id', (
    select id::text from public.propose_manual_obligation(
      'bbbbbbbb-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      current_setting('test.currency_id')::uuid,
      3.00,
      'Coffee run'
    )
  ), false);
end;
$$;

set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_status public.manual_obligation_status;
begin
  select status into v_status
  from public.decline_manual_obligation(current_setting('test.decline_id')::uuid);
  if v_status <> 'declined' then
    raise exception 'FAIL: expected bob''s decline to mark the obligation declined, got %', v_status;
  end if;
  raise notice 'PASS: bob declined the obligation, now declined';
end;
$$;

-- Cancel path: alice proposes again, then cancels it herself before bob responds.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_id uuid;
  v_status public.manual_obligation_status;
begin
  select id into v_id from public.propose_manual_obligation(
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    current_setting('test.currency_id')::uuid,
    2.00,
    'Parking'
  );
  perform set_config('test.cancel_id', v_id::text, false);

  select status into v_status from public.cancel_manual_obligation(v_id);
  if v_status <> 'cancelled' then
    raise exception 'FAIL: expected alice''s cancel to mark the obligation cancelled, got %', v_status;
  end if;
  raise notice 'PASS: alice cancelled her own proposal before bob responded';
end;
$$;

-- Bob cannot approve a cancelled proposal.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform public.approve_manual_obligation(current_setting('test.cancel_id')::uuid);
    raise exception 'FAIL: expected approving a cancelled proposal to be rejected';
  exception
    when others then
      if sqlerrm not like '%no pending obligation proposal found%' then raise; end if;
      raise notice 'PASS: cannot approve a cancelled proposal';
  end;
end;
$$;

-- Non-friends cannot propose obligations to each other.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.propose_manual_obligation(
      'cccccccc-0000-0000-0000-000000000003',
      'aaaaaaaa-0000-0000-0000-000000000001',
      current_setting('test.currency_id')::uuid,
      1.00,
      'not friends yet'
    );
    raise exception 'FAIL: expected a proposal between non-friends to be rejected';
  exception
    when others then
      if sqlerrm not like '%only propose a manual obligation to a friend%' then raise; end if;
      raise notice 'PASS: cannot propose a manual obligation to someone who is not a friend';
  end;
end;
$$;

-- A currency that isn't available to both parties is rejected. Carol
-- creates a personal currency only she can see, then alice (now friends
-- with carol, to isolate this check from the friendship check above)
-- tries to use it with bob.
set
  request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  insert into public.currencies (name, category, owner_user_id)
  values ('Carol Only Points', 'points', 'cccccccc-0000-0000-0000-000000000003');
  perform set_config('test.carol_currency_id', (
    select id::text from public.currencies where name = 'Carol Only Points'
  ), false);
end;
$$;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.propose_manual_obligation(
      'bbbbbbbb-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      current_setting('test.carol_currency_id')::uuid,
      1.00,
      'wrong currency'
    );
    raise exception 'FAIL: expected a currency not shared by both parties to be rejected';
  exception
    when others then
      if sqlerrm not like '%currency isn''t available to both people%' then raise; end if;
      raise notice 'PASS: a currency not available to both parties is rejected';
  end;
end;
$$;

-- A non-positive amount is rejected.
do $$
begin
  begin
    perform public.propose_manual_obligation(
      'bbbbbbbb-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      current_setting('test.currency_id')::uuid,
      0,
      'zero amount'
    );
    raise exception 'FAIL: expected a zero amount to be rejected';
  exception
    when others then
      if sqlerrm not like '%amount must be greater than zero%' then raise; end if;
      raise notice 'PASS: a non-positive amount is rejected';
  end;
end;
$$;

-- Blocking cancels the friendship, which then blocks new proposals too.
do $$
begin
  perform public.block_user('bbbbbbbb-0000-0000-0000-000000000002');
end;
$$;

do $$
begin
  begin
    perform public.propose_manual_obligation(
      'bbbbbbbb-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      current_setting('test.currency_id')::uuid,
      1.00,
      'after block'
    );
    raise exception 'FAIL: expected a proposal after blocking to be rejected';
  exception
    when others then
      if sqlerrm not like '%only propose a manual obligation to a friend%' then raise; end if;
      raise notice 'PASS: blocking cancels the friendship, so a new proposal is rejected too';
  end;
end;
$$;

-- anon has no access at all.
reset role;

set role anon;

do $$
begin
  begin
    perform 1 from public.manual_obligation_proposals limit 1;
    raise exception 'FAIL: expected anon SELECT on manual_obligation_proposals to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level access to manual_obligation_proposals';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'manual_obligations.test.sql: all assertions passed';
end;
$$;
