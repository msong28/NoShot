-- Profiles: one row per completed account (display name + username set).
-- A signed-up auth.users row with no matching profiles row means the user
-- hasn't finished the minimal setup step yet (AUTH-02).

create type public.profile_status as enum ('active', 'suspended', 'deleted');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  birth_year integer,
  age_acknowledged_at timestamptz,
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (char_length(trim(display_name)) between 1 and 50),
  constraint profiles_birth_year_range check (
    birth_year is null or birth_year between 1900 and 2100
  )
);

-- Usernames are unique while the account is live; a deleted account's
-- username can be reclaimed (deleted_at is set by the future account
-- deletion workflow, Milestone 14).
create unique index profiles_username_lower_idx on public.profiles (lower(username))
where
  deleted_at is null;

create index profiles_status_idx on public.profiles (status);

create function public.set_updated_at () returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row
execute function public.set_updated_at ();

-- Server-side enforcement of the 16+ requirement (AUTH-04). This can't be a
-- CHECK constraint because it depends on the current date (STABLE, not
-- IMMUTABLE), so it's a trigger instead.
create function public.enforce_min_age () returns trigger language plpgsql as $$
begin
  if new.birth_year is not null
     and (extract(year from now())::integer - new.birth_year) < 16 then
    raise exception 'birth_year indicates an age below the minimum of 16';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_min_age before insert
or
update on public.profiles for each row
execute function public.enforce_min_age ();

alter table public.profiles enable row level security;

-- Table privileges: no anon access at all. Authenticated users get row
-- access strictly through the RLS policies below (no client-side delete
-- path yet; account deletion is a future SECURITY DEFINER function).
revoke all on public.profiles
from
  anon;

grant
select
,
insert
,
update on public.profiles to authenticated;

create policy profiles_select_own on public.profiles for
select
  to authenticated using (id = auth.uid ());

create policy profiles_insert_own on public.profiles for insert to authenticated
with
  check (id = auth.uid ());

create policy profiles_update_own on public.profiles
for update
  to authenticated using (id = auth.uid ())
with
  check (id = auth.uid ());
