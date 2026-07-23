-- Behaviour test for reactivate_account_request() (follow-up to
-- delete_account_request() -- see 20260723160000_account_reactivation.sql
-- for why reactivating the same row, rather than a literal second account,
-- is the correct fix for "let me sign up again with the same email"). Same
-- convention as the other behaviour tests: must ERROR on any failed
-- assertion.
insert into
  auth.users (id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- alice, deletes then reactivates
  ('bbbbbbbb-0000-0000-0000-000000000002'); -- bob, still active, owns the 'bob' username

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

-- Cannot reactivate a still-active account.
do $$
begin
  begin
    perform public.reactivate_account_request('Alice Again', 'alice_again', 2000);
    raise exception 'FAIL: expected reactivation of an active account to be rejected';
  exception
    when others then
      if sqlerrm not like '%only a deleted account can be reactivated%' then raise; end if;
      raise notice 'PASS: cannot reactivate an account that is not deleted';
  end;
end;
$$;

-- Alice deletes her account.
do $$
begin
  perform public.delete_account_request();
end;
$$;

-- Cannot reactivate into an already-taken username.
do $$
begin
  begin
    perform public.reactivate_account_request('Alice Again', 'bob', 2000);
    raise exception 'FAIL: expected reactivation with a taken username to be rejected';
  exception
    when others then
      if sqlerrm not like '%already taken%' then raise; end if;
      raise notice 'PASS: cannot reactivate into a username that is already taken';
  end;
end;
$$;

-- Cannot reactivate under the minimum age.
do $$
begin
  begin
    perform public.reactivate_account_request(
      'Alice Again', 'alice_again', extract(year from now())::integer - 10
    );
    raise exception 'FAIL: expected reactivation under the minimum age to be rejected';
  exception
    when others then
      if sqlerrm not like '%below the minimum%' then raise; end if;
      raise notice 'PASS: cannot reactivate with a birth_year indicating an age below 16';
  end;
end;
$$;

-- A valid reactivation succeeds and fully restores an active, usable profile.
do $$
declare
  v_row public.profiles;
begin
  select * into v_row from public.reactivate_account_request('Alice Again', 'Alice_Again', 2000);

  if v_row.status <> 'active' then
    raise exception 'FAIL: expected status = active, got %', v_row.status;
  end if;
  if v_row.deleted_at is not null then
    raise exception 'FAIL: expected deleted_at to be cleared';
  end if;
  if v_row.username <> 'alice_again' then
    raise exception 'FAIL: expected the username to be normalized to lowercase, got %', v_row.username;
  end if;
  if v_row.display_name <> 'Alice Again' then
    raise exception 'FAIL: expected display_name = Alice Again, got %', v_row.display_name;
  end if;
  if v_row.birth_year <> 2000 then
    raise exception 'FAIL: expected birth_year = 2000, got %', v_row.birth_year;
  end if;
  if v_row.age_acknowledged_at is null then
    raise exception 'FAIL: expected age_acknowledged_at to be set';
  end if;

  raise notice 'PASS: reactivate_account_request restores an active, usable profile';
end;
$$;

-- Reactivating again (now already active) is rejected the same way as before.
do $$
begin
  begin
    perform public.reactivate_account_request('Alice Once More', 'alice_once_more', 2000);
    raise exception 'FAIL: expected reactivation of a now-active account to be rejected';
  exception
    when others then
      if sqlerrm not like '%only a deleted account can be reactivated%' then raise; end if;
      raise notice 'PASS: cannot reactivate an account that is already active again';
  end;
end;
$$;

reset role;

-- anon cannot call the RPC at all.
set role anon;

do $$
begin
  begin
    perform public.reactivate_account_request('X', 'x', 2000);
    raise exception 'FAIL: expected anon to be denied execute on reactivate_account_request';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no execute access to reactivate_account_request';
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'account_reactivation.test.sql: all assertions passed';
end;
$$;
