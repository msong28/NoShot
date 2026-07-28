-- Behaviour test for currency management (Phase 1 fixes: edit/reorder/
-- delete a personal currency preset). Same convention as currencies.test.sql:
-- must ERROR on any failed assertion.
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
  v_id uuid;
begin
  insert into public.currencies (name, category, owner_user_id)
  values ('Board games', 'items', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning id into v_id;
  perform set_config('test.currency_id', v_id::text, false);
end;
$$;

-- Renaming and reordering your own currency both succeed.
do $$
declare
  v_name text;
  v_sort integer;
  v_status public.currency_moderation_status;
begin
  update public.currencies set name = 'Board Game Night'
  where id = current_setting('test.currency_id')::uuid
  returning name into v_name;
  if v_name <> 'Board Game Night' then
    raise exception 'FAIL: expected the rename to take effect, got %', v_name;
  end if;
  raise notice 'PASS: the owner can rename their own currency';

  update public.currencies set sort_order = 5
  where id = current_setting('test.currency_id')::uuid
  returning sort_order, moderation_status into v_sort, v_status;
  if v_sort <> 5 then
    raise exception 'FAIL: expected sort_order to update to 5, got %', v_sort;
  end if;
  if v_status <> 'approved' then
    raise exception 'FAIL: expected an unrelated reorder to leave moderation_status alone, got %', v_status;
  end if;
  raise notice 'PASS: reordering does not disturb moderation_status';
end;
$$;

-- Renaming into the warn tier re-triggers moderation.
do $$
declare
  v_status public.currency_moderation_status;
begin
  update public.currencies set name = 'Chug Contest'
  where id = current_setting('test.currency_id')::uuid
  returning moderation_status into v_status;
  if v_status <> 'pending_review' then
    raise exception 'FAIL: expected a rename into the warn tier to flip to pending_review, got %', v_status;
  end if;
  raise notice 'PASS: renaming re-runs moderation and can flip the tier';
end;
$$;

-- Renaming into the hard-block tier is rejected outright.
do $$
begin
  begin
    update public.currencies set name = 'Cocaine Run'
    where id = current_setting('test.currency_id')::uuid;
    raise exception 'FAIL: expected a hard-blocked rename to be rejected';
  exception
    when others then
      if sqlerrm not like '%isn''t allowed%' then raise; end if;
      raise notice 'PASS: renaming into the hard-block tier is rejected';
  end;
end;
$$;

-- Bob cannot update alice's currency -- RLS filters the row, 0 rows change.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
begin
  update public.currencies set sort_order = 99
  where id = current_setting('test.currency_id')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: expected bob''s update of alice''s currency to affect 0 rows, affected %', v_count;
  end if;
  raise notice 'PASS: a non-owner cannot update someone else''s currency';
end;
$$;

-- Nobody -- not even the owner -- can update a built-in currency.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  update public.currencies set sort_order = 1 where name = 'Meal' and is_builtin;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: expected a built-in currency update to affect 0 rows, affected %', v_count;
  end if;
  raise notice 'PASS: a built-in currency cannot be updated by a client';
end;
$$;

-- A currency an admin has blocked (simulated directly here, same end state
-- moderation_actions' remove_content() leaves behind) can't be touched by
-- its owner at all, not even an unrelated reorder.
reset role;

do $$
declare
  v_id uuid;
begin
  insert into public.currencies (name, category, owner_user_id, moderation_status)
  values ('Blocked One', 'items', 'aaaaaaaa-0000-0000-0000-000000000001', 'blocked')
  returning id into v_id;
  perform set_config('test.blocked_currency_id', v_id::text, false);
end;
$$;

set role authenticated;

set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  update public.currencies set sort_order = 1
  where id = current_setting('test.blocked_currency_id')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: expected updating a blocked currency to affect 0 rows, affected %', v_count;
  end if;
  raise notice 'PASS: a blocked currency cannot be updated by its owner, even to reorder it';
end;
$$;

-- Deleting an unused currency succeeds.
do $$
declare
  v_id uuid;
  v_count integer;
begin
  insert into public.currencies (name, category, owner_user_id)
  values ('Temp Currency', 'items', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning id into v_id;

  delete from public.currencies where id = v_id;

  select count(*) into v_count from public.currencies where id = v_id;
  if v_count <> 0 then
    raise exception 'FAIL: expected the unused currency to be gone, found %', v_count;
  end if;
  raise notice 'PASS: an unused personal currency can be deleted';
end;
$$;

-- A currency already used in a bet cannot be deleted -- the FK on
-- bet_commitments blocks it, preserving that bet's history.
do $$
declare
  v_currency_id uuid;
  v_bet_id uuid;
begin
  insert into public.currencies (name, category, owner_user_id)
  values ('In Use Currency', 'items', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning id into v_currency_id;

  select id into v_bet_id from public.create_or_counter_bet(
    null, null, 'Dishes tonight', '', null, 'participant_submission', null, false,
    '[{"outcome_key":"alice_wins","label":"Alice wins"},{"outcome_key":"bob_wins","label":"Bob wins"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'outcome_key', 'alice_wins', 'currency_id', v_currency_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1),
      jsonb_build_object('user_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'outcome_key', 'bob_wins', 'currency_id', v_currency_id, 'stake_quantity', 1, 'odds_numerator', 1, 'odds_denominator', 1)
    )
  );

  begin
    delete from public.currencies where id = v_currency_id;
    raise exception 'FAIL: expected deleting a currency in use by a bet to be rejected';
  exception
    when foreign_key_violation then
      raise notice 'PASS: a currency already used in a bet cannot be deleted';
  end;
end;
$$;

-- Bob cannot delete alice's currency.
set
  request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
begin
  delete from public.currencies where id = current_setting('test.currency_id')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: expected bob''s delete of alice''s currency to affect 0 rows, affected %', v_count;
  end if;
  raise notice 'PASS: a non-owner cannot delete someone else''s currency';
end;
$$;

-- Nobody can delete a built-in currency.
set
  request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  delete from public.currencies where name = 'Meal' and is_builtin;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: expected a built-in currency delete to affect 0 rows, affected %', v_count;
  end if;
  raise notice 'PASS: a built-in currency cannot be deleted by a client';
end;
$$;

-- anon has no update/delete access at all.
reset role;

set role anon;

do $$
begin
  begin
    update public.currencies set sort_order = 1 where name = 'Meal';
    raise exception 'FAIL: expected anon UPDATE on currencies to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level UPDATE access to currencies';
  end;
end;
$$;

do $$
begin
  begin
    delete from public.currencies where name = 'Meal';
    raise exception 'FAIL: expected anon DELETE on currencies to be denied';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no table-level DELETE access to currencies';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'currency_management.test.sql: all assertions passed';
end;
$$;
