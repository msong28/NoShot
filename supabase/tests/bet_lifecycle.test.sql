-- Behaviour test for 20261113090000_bet_lifecycle.sql: changing an active bet
-- by consent, report-then-confirm "who won", call-off, timers, void reasons.
-- Same convention as the other files: must ERROR on any failed assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice
  ('bbbbbbbb-0000-0000-0000-000000000002'), -- bob
  ('dddddddd-0000-0000-0000-000000000004'); -- dave (uninvolved)

insert into
  public.profiles (id, username, display_name, birth_year, age_acknowledged_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice', 'Alice', 2000, now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob', 'Bob', 1998, now()),
  ('dddddddd-0000-0000-0000-000000000004', 'dave', 'Dave', 1996, now());

-- Test helpers (rolled back with the rest of the file). Invoker-rights, so
-- auth.uid() is whoever the test is acting as.
create function public.test_as (p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user::text, false);
$$;

create function public.test_terms (p_creator uuid, p_rival uuid, p_creator_stake numeric, p_rival_stake numeric) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('user_id', p_creator, 'outcome_key', 'creator_wins',
      'currency_id', (select id from public.currencies where name = 'Meal'),
      'stake_quantity', p_creator_stake, 'odds_numerator', 1, 'odds_denominator', 1),
    jsonb_build_object('user_id', p_rival, 'outcome_key', 'rival_wins',
      'currency_id', (select id from public.currencies where name = 'Meal'),
      'stake_quantity', p_rival_stake, 'odds_numerator', 1, 'odds_denominator', 1)
  );
$$;

create function public.test_sides () returns jsonb language sql as $$
  select '[{"outcome_key":"creator_wins","label":"Creator wins"},{"outcome_key":"rival_wins","label":"Rival wins"}]'::jsonb;
$$;

-- Proposes a bet as p_creator; if p_accept, accepts it as p_rival. Leaves the
-- session acting as p_creator.
create function public.test_bet (p_title text, p_creator uuid, p_rival uuid, p_accept boolean) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  perform public.test_as(p_creator);
  select id into v_id from public.create_or_counter_bet(
    null, null, p_title, '', null, 'participant_submission', null, false,
    public.test_sides(), public.test_terms(p_creator, p_rival, 1, 1)
  );
  if p_accept then
    perform public.test_as(p_rival);
    perform public.approve_bet_version(v_id, 1, 'approved');
    perform public.test_as(p_creator);
  end if;
  return v_id;
end;
$$;

create function public.test_ledger_count (p_bet uuid) returns integer language sql as $$
  select count(*)::integer from public.ledger_entries where source_type = 'bet' and source_id = p_bet;
$$;

grant execute on function public.test_ledger_count (uuid) to authenticated;

set role authenticated;

-- ---------------------------------------------------------------------------
-- Who won: admitting a loss is final immediately
-- ---------------------------------------------------------------------------
do $$
declare
  v_bet uuid := public.test_bet('Admit loss', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  v_status public.bet_status;
begin
  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  select status into v_status from public.submit_bet_result(v_bet, 'creator_wins', null);
  if v_status <> 'resolved' then
    raise exception 'FAIL: reporting your own loss should be final, got %', v_status;
  end if;
  if public.test_ledger_count(v_bet) <> 1 then
    raise exception 'FAIL: expected the loss to post one ledger entry';
  end if;
  raise notice 'PASS: reporting that you lost settles the bet immediately';
end;
$$;

-- ---------------------------------------------------------------------------
-- Who won: claim -> dispute -> no re-pushing -> counter-claim -> call off
-- ---------------------------------------------------------------------------
do $$
declare
  v_bet uuid := public.test_bet('Dispute path', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  v_bet_row public.bets;
  v_submission uuid;
begin
  -- Alice claims the win.
  select * into v_bet_row from public.submit_bet_result(v_bet, 'creator_wins', null);
  if v_bet_row.status <> 'pending_result'
    or v_bet_row.result_reported_by <> 'aaaaaaaa-0000-0000-0000-000000000001' then
    raise exception 'FAIL: expected pending_result reported by alice, got %', v_bet_row.status;
  end if;

  begin
    perform public.submit_bet_result(v_bet, 'creator_wins', null);
    raise exception 'FAIL: reporter should not be able to report twice while pending';
  exception when others then
    if sqlerrm not like '%already reported a result%' then raise; end if;
  end;
  raise notice 'PASS: a pending report can''t be re-sent by its reporter';

  -- Bob disputes.
  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  select id into v_submission from public.bet_result_submissions where bet_id = v_bet;
  select * into v_bet_row from public.confirm_bet_result(v_bet, v_submission, 'declined');
  if v_bet_row.status <> 'disputed' or v_bet_row.result_due_at is not null then
    raise exception 'FAIL: expected disputed with no timer, got % / %', v_bet_row.status, v_bet_row.result_due_at;
  end if;
  raise notice 'PASS: disputing a report moves the bet to disputed and stops the timer';

  -- Alice can't push the same rejected claim again.
  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');
  begin
    perform public.submit_bet_result(v_bet, 'creator_wins', null);
    raise exception 'FAIL: a rejected claim should not be re-submittable';
  exception when others then
    if sqlerrm not like '%already disputed%' then raise; end if;
  end;
  raise notice 'PASS: a claim the other side rejected can''t be pushed again';

  -- Bob counter-claims; Alice disputes that too.
  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  select * into v_bet_row from public.submit_bet_result(v_bet, 'rival_wins', null);
  if v_bet_row.status <> 'pending_result' then
    raise exception 'FAIL: a counter-claim from disputed should be pending again, got %', v_bet_row.status;
  end if;
  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');
  select result_submission_id into v_submission from public.bets where id = v_bet;
  perform public.confirm_bet_result(v_bet, v_submission, 'declined');

  -- Dave can't call it off; Alice can.
  perform public.test_as('dddddddd-0000-0000-0000-000000000004');
  begin
    perform public.call_off_bet(v_bet);
    raise exception 'FAIL: an outsider should not be able to call off a bet';
  exception when others then
    if sqlerrm not like '%only a participant%' then raise; end if;
  end;

  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');
  select * into v_bet_row from public.call_off_bet(v_bet);
  if v_bet_row.status <> 'voided' or v_bet_row.void_reason <> 'called_off' then
    raise exception 'FAIL: expected voided/called_off, got % / %', v_bet_row.status, v_bet_row.void_reason;
  end if;
  if public.test_ledger_count(v_bet) <> 0 then
    raise exception 'FAIL: a called-off bet must not owe anything';
  end if;
  raise notice 'PASS: a disputed bet can be called off by either side, nothing owed';
end;
$$;

-- call_off_bet is only for disputes.
do $$
declare
  v_bet uuid := public.test_bet('Not disputed', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', true);
begin
  begin
    perform public.call_off_bet(v_bet);
    raise exception 'FAIL: calling off an undisputed active bet should be rejected';
  exception when others then
    if sqlerrm not like '%only a disputed bet%' then raise; end if;
  end;
  raise notice 'PASS: an undisputed bet can''t be called off unilaterally';
end;
$$;

-- ---------------------------------------------------------------------------
-- Answering a pending report with your own report disputes it; only the
-- latest report can be confirmed.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bet uuid := public.test_bet('Counter report', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  v_first uuid;
  v_latest uuid;
  v_status public.bet_status;
begin
  perform public.submit_bet_result(v_bet, 'creator_wins', null);
  select id into v_first from public.bet_result_submissions where bet_id = v_bet;

  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  perform public.submit_bet_result(v_bet, 'tie', null);
  if not exists (
    select 1 from public.bet_result_confirmations
    where result_submission_id = v_first and user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and decision = 'declined'
  ) then
    raise exception 'FAIL: a counter-report should record a dispute of the pending report';
  end if;

  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');
  select result_submission_id into v_latest from public.bets where id = v_bet;
  begin
    perform public.confirm_bet_result(v_bet, v_first, 'approved');
    raise exception 'FAIL: confirming a superseded report should be rejected';
  exception when others then
    if sqlerrm not like '%replaced by a newer%' and sqlerrm not like '%already responded%' then raise; end if;
  end;

  select status into v_status from public.confirm_bet_result(v_bet, v_latest, 'approved');
  if v_status <> 'tied' then
    raise exception 'FAIL: expected the confirmed tie to finalize, got %', v_status;
  end if;
  raise notice 'PASS: a counter-report disputes the pending one; only the latest can be confirmed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Timers: a report nobody answers locks in; a proposal nobody answers expires
-- ---------------------------------------------------------------------------
do $$
declare
  v_bet uuid := public.test_bet('Silence', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', true);
begin
  perform public.submit_bet_result(v_bet, 'creator_wins', null);
  perform set_config('test.silence_bet', v_bet::text, false);
end;
$$;

do $$
declare
  v_bet uuid := public.test_bet('Ignored proposal', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', false);
begin
  perform set_config('test.ignored_bet', v_bet::text, false);
end;
$$;

-- Nothing is due yet.
do $$
begin
  if public.finalize_due_bets() <> 0 then
    raise exception 'FAIL: nothing should be finalized before its time';
  end if;
  raise notice 'PASS: finalize_due_bets leaves bets alone until they are due';
end;
$$;

reset role;

update public.bets
set result_due_at = now() - interval '1 minute'
where id = current_setting('test.silence_bet')::uuid;

update public.bet_versions
set created_at = now() - interval '8 days'
where bet_id = current_setting('test.ignored_bet')::uuid;

set role authenticated;

do $$
declare
  v_status public.bet_status;
  v_reason text;
begin
  -- Dave isn't in either bet, so his call touches neither.
  perform public.test_as('dddddddd-0000-0000-0000-000000000004');
  if public.finalize_due_bets() <> 0 then
    raise exception 'FAIL: finalize_due_bets should only touch the caller''s own bets';
  end if;

  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  if public.finalize_due_bets() <> 2 then
    raise exception 'FAIL: expected the overdue report and the stale proposal to be handled';
  end if;

  select status into v_status from public.bets where id = current_setting('test.silence_bet')::uuid;
  if v_status <> 'resolved' or public.test_ledger_count(current_setting('test.silence_bet')::uuid) <> 1 then
    raise exception 'FAIL: an unanswered report should lock in and post the debt, got %', v_status;
  end if;
  raise notice 'PASS: a report nobody disputes locks in after the window';

  select status, void_reason into v_status, v_reason from public.bets where id = current_setting('test.ignored_bet')::uuid;
  if v_status <> 'voided' or v_reason <> 'expired' then
    raise exception 'FAIL: expected an unanswered proposal to expire, got % / %', v_status, v_reason;
  end if;
  raise notice 'PASS: a proposal nobody answers expires';
end;
$$;

-- ---------------------------------------------------------------------------
-- Void reasons
-- ---------------------------------------------------------------------------
do $$
declare
  v_declined uuid := public.test_bet('Declined', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  v_withdrawn uuid := public.test_bet('Withdrawn', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  v_cancelled uuid := public.test_bet('Cancelled', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  v_reason text;
begin
  perform public.withdraw_bet(v_withdrawn);
  perform public.propose_cancel_bet(v_cancelled, null);

  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');
  perform public.approve_bet_version(v_declined, 1, 'declined');
  perform public.approve_cancel_bet(v_cancelled, 'approved');

  select void_reason into v_reason from public.bets where id = v_declined;
  if v_reason is distinct from 'declined' then raise exception 'FAIL: declined bet has reason %', v_reason; end if;
  select void_reason into v_reason from public.bets where id = v_withdrawn;
  if v_reason is distinct from 'withdrawn' then raise exception 'FAIL: withdrawn bet has reason %', v_reason; end if;
  select void_reason into v_reason from public.bets where id = v_cancelled;
  if v_reason is distinct from 'cancelled' then raise exception 'FAIL: cancelled bet has reason %', v_reason; end if;
  raise notice 'PASS: voided bets record whether they were declined, withdrawn or cancelled';
end;
$$;

-- ---------------------------------------------------------------------------
-- Changing an active bet
-- ---------------------------------------------------------------------------
do $$
declare
  v_bet uuid := public.test_bet('Original terms', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  v_row public.bets;
  v_amendment uuid;
  v_stake numeric;
begin
  perform set_config('test.amend_bet', v_bet::text, false);

  -- The old back door is closed.
  begin
    perform public.create_or_counter_bet(
      v_bet, null, 'Sneaky edit', '', null, 'participant_submission', null, false,
      public.test_sides(),
      public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 1)
    );
    raise exception 'FAIL: rewriting an active bet directly should be rejected';
  exception when others then
    if sqlerrm not like '%already agreed%' then raise; end if;
  end;
  raise notice 'PASS: an active bet can''t be rewritten without the other side';

  -- Propose: bet stays exactly as agreed.
  select * into v_row from public.propose_bet_amendment(
    v_bet, 'Bigger stakes', '', null, 'participant_submission', null, false,
    public.test_sides(),
    public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 2, 2)
  );
  select * into v_row from public.bets where id = v_bet;
  if v_row.status <> 'active' or v_row.title <> 'Original terms' or v_row.current_version <> 1 then
    raise exception 'FAIL: proposing a change must not alter the live bet (% / % / %)', v_row.status, v_row.title, v_row.current_version;
  end if;
  raise notice 'PASS: proposing a change leaves the agreed bet untouched';

  begin
    perform public.propose_bet_amendment(
      v_bet, 'Another', '', null, 'participant_submission', null, false,
      public.test_sides(),
      public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 3, 3)
    );
    raise exception 'FAIL: a second pending change should be rejected';
  exception when others then
    if sqlerrm not like '%already a change waiting%' then raise; end if;
  end;

  select id into v_amendment from public.bet_amendments where bet_id = v_bet and status = 'pending';
  begin
    perform public.respond_to_bet_amendment(v_amendment, 'approved');
    raise exception 'FAIL: proposer should not be able to accept their own change';
  exception when others then
    if sqlerrm not like '%your own change%' then raise; end if;
  end;

  -- Bob says no: the bet survives.
  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  select * into v_row from public.respond_to_bet_amendment(v_amendment, 'declined');
  if v_row.status <> 'active' or v_row.title <> 'Original terms' then
    raise exception 'FAIL: declining a change must keep the bet active and unchanged, got % / %', v_row.status, v_row.title;
  end if;
  raise notice 'PASS: declining a change keeps the bet active on its original terms';

  -- Propose again; Bob accepts: new terms, still active, version 2.
  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');
  perform public.propose_bet_amendment(
    v_bet, 'Bigger stakes', '', null, 'participant_submission', null, false,
    public.test_sides(),
    public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 2, 2)
  );
  select id into v_amendment from public.bet_amendments where bet_id = v_bet and status = 'pending';
  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  select * into v_row from public.respond_to_bet_amendment(v_amendment, 'approved');
  select stake_quantity into v_stake from public.bet_commitments bc
  join public.bet_participants bp on bp.id = bc.participant_id
  where bc.bet_id = v_bet and bc.version_no = v_row.current_version
    and bp.user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_row.status <> 'active' or v_row.title <> 'Bigger stakes' or v_row.current_version <> 2 or v_stake <> 2 then
    raise exception 'FAIL: accepting should apply the new terms and stay active (% / % / v% / stake %)',
      v_row.status, v_row.title, v_row.current_version, v_stake;
  end if;
  if (select count(*) from public.bet_approvals where bet_id = v_bet and version_no = 2 and decision = 'approved') <> 2 then
    raise exception 'FAIL: both people should be recorded as approving version 2';
  end if;
  raise notice 'PASS: accepting a change applies it and the bet stays active';
end;
$$;

do $$
declare
  v_bet uuid := current_setting('test.amend_bet')::uuid;
  v_amendment uuid;
begin
  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');

  -- Can't swap people.
  begin
    perform public.propose_bet_amendment(
      v_bet, 'Swap', '', null, 'participant_submission', null, false,
      public.test_sides(),
      public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004', 1, 1)
    );
    raise exception 'FAIL: a change that swaps participants should be rejected';
  exception when others then
    if sqlerrm not like '%add or remove people%' then raise; end if;
  end;

  -- Invalid terms are caught at proposal time (funding check: alice's payout
  -- of 5 exceeds bob's stake of 1), and nothing is recorded.
  begin
    perform public.propose_bet_amendment(
      v_bet, 'Lopsided', '', null, 'participant_submission', null, false,
      public.test_sides(),
      public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 5, 1)
    );
    raise exception 'FAIL: a change with invalid terms should be rejected up front';
  exception when others then
    if sqlerrm not like '%exceeds what everyone else has staked%' then raise; end if;
  end;
  if exists (select 1 from public.bet_amendments where bet_id = v_bet and status = 'pending') then
    raise exception 'FAIL: a rejected proposal must not leave a pending change behind';
  end if;
  if (select current_version from public.bets where id = v_bet) <> 2 then
    raise exception 'FAIL: the validation dry run must not change the bet';
  end if;
  raise notice 'PASS: invalid or people-changing proposals are rejected and leave nothing behind';

  -- Withdraw your own.
  perform public.propose_bet_amendment(
    v_bet, 'Never mind', '', null, 'participant_submission', null, false,
    public.test_sides(),
    public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 1)
  );
  select id into v_amendment from public.bet_amendments where bet_id = v_bet and status = 'pending';
  perform public.withdraw_bet_amendment(v_amendment);
  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  begin
    perform public.respond_to_bet_amendment(v_amendment, 'approved');
    raise exception 'FAIL: a withdrawn change should not be acceptable';
  exception when others then
    if sqlerrm not like '%already answered or withdrawn%' then raise; end if;
  end;
  raise notice 'PASS: a withdrawn change can''t be accepted';

  -- A change can't be accepted once the bet has moved on.
  perform public.test_as('aaaaaaaa-0000-0000-0000-000000000001');
  perform public.propose_bet_amendment(
    v_bet, 'Too late', '', null, 'participant_submission', null, false,
    public.test_sides(),
    public.test_terms('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 1)
  );
  select id into v_amendment from public.bet_amendments where bet_id = v_bet and status = 'pending';
  perform public.submit_bet_result(v_bet, 'creator_wins', null);
  perform public.test_as('bbbbbbbb-0000-0000-0000-000000000002');
  begin
    perform public.respond_to_bet_amendment(v_amendment, 'approved');
    raise exception 'FAIL: accepting a change on a bet that has moved on should be rejected';
  exception when others then
    if sqlerrm not like '%moved on%' then raise; end if;
  end;
  raise notice 'PASS: a stale change can''t be accepted after a result is reported';
end;
$$;

-- Visibility and write protection.
do $$
begin
  perform public.test_as('dddddddd-0000-0000-0000-000000000004');
  if exists (select 1 from public.bet_amendments) then
    raise exception 'FAIL: an outsider should not see anyone''s change requests';
  end if;
  begin
    insert into public.bet_amendments (bet_id, proposed_by, base_version, title, sides, participants)
    values (current_setting('test.amend_bet')::uuid, 'dddddddd-0000-0000-0000-000000000004', 1, 'x', '[]', '[]');
    raise exception 'FAIL: direct insert into bet_amendments should be denied';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: change requests are RPC-only and visible only to the bet''s people';
end;
$$;

reset role;
