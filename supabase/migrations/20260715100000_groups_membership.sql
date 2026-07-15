-- Groups & membership (Milestone 4 / GR-01..06).
--
-- Same shape as the friendships migration: RLS default-denies direct writes,
-- every state transition (create/invite/respond/leave/remove/archive) goes
-- through a SECURITY DEFINER function below.
create type public.group_status as enum ('active', 'archived');

create type public.group_member_role as enum ('owner', 'member');

create type public.group_member_status as enum ('invited', 'active', 'left', 'removed', 'declined');

create table public.groups (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  status public.group_status not null default 'active',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint groups_name_length check (char_length(trim(name)) between 1 and 50)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_member_role not null default 'member',
  status public.group_member_status not null default 'active',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  left_at timestamptz,
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;

alter table public.group_members enable row level security;

revoke all on public.groups
from
  anon;

revoke all on public.group_members
from
  anon;

-- Read-only direct access; every write happens inside the functions below.
grant
select
  on public.groups to authenticated;

grant
select
  on public.group_members to authenticated;

-- security definer: bypasses RLS on group_members to answer "which groups
-- has this user ever had a membership row in (any status)" without the
-- self-referential-policy recursion that would otherwise require.
create function public.get_my_group_ids () returns setof uuid language sql stable security definer
set
  search_path = '' as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;

create policy groups_select_member on public.groups for
select
  to authenticated using (
    id in (
      select
        public.get_my_group_ids ()
    )
  );

create policy group_members_select_same_group on public.group_members for
select
  to authenticated using (
    group_id in (
      select
        public.get_my_group_ids ()
    )
  );

-- security definer: needs to see both directions of a block regardless of
-- which side is calling, same reasoning as friendships' is_blocked_pair.
create function public.create_group (p_name text) returns public.groups language plpgsql security definer
set
  search_path = '' as $$
declare
  v_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 50 then
    raise exception 'group name must be between 1 and 50 characters';
  end if;

  insert into public.groups (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_group.id, auth.uid(), 'owner', 'active', now());

  return v_group;
end;
$$;

create function public.invite_to_group (p_group_id uuid, p_user_id uuid) returns public.group_members language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.group_members;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot invite yourself';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'only an active member can invite to this group';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and deleted_at is null) then
    raise exception 'user not found';
  end if;
  if public.is_blocked_pair(auth.uid(), p_user_id) then
    raise exception 'cannot invite this user';
  end if;

  insert into public.group_members (group_id, user_id, role, status, invited_by)
  values (p_group_id, p_user_id, 'member', 'invited', auth.uid())
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'this user already has a membership record for this group';
end;
$$;

create function public.respond_to_group_invite (p_group_id uuid, p_accept boolean) returns public.group_members language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.group_members;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.group_members
  set status = (case when p_accept then 'active' else 'declined' end)::public.group_member_status,
      joined_at = (case when p_accept then now() else joined_at end)
  where group_id = p_group_id
    and user_id = auth.uid()
    and status = 'invited'
  returning * into v_row;

  if v_row.user_id is null then
    raise exception 'no pending invite found for you in that group';
  end if;

  return v_row;
end;
$$;

-- Milestone 4 scope note: GR-03 says a member can't leave with active bets
-- or outstanding group-scoped obligations -- those tables don't exist until
-- Milestones 6/9, so there's nothing to check yet. Revisit this function
-- once bets/ledger land.
create function public.leave_group (p_group_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.group_members
  set status = 'left',
      left_at = now()
  where group_id = p_group_id
    and user_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'you are not an active member of that group';
  end if;
end;
$$;

create function public.remove_member (p_group_id uuid, p_user_id uuid) returns public.group_members language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.group_members;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'use leave_group to remove yourself';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active' and role = 'owner'
  ) then
    raise exception 'only the group owner can remove a member';
  end if;

  update public.group_members
  set status = 'removed',
      left_at = now()
  where group_id = p_group_id
    and user_id = p_user_id
    and status = 'active'
  returning * into v_row;

  if v_row.user_id is null then
    raise exception 'that user is not an active member of this group';
  end if;

  return v_row;
end;
$$;

create function public.archive_group (p_group_id uuid) returns public.groups language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.groups;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active' and role = 'owner'
  ) then
    raise exception 'only the group owner can archive this group';
  end if;

  update public.groups
  set status = 'archived',
      archived_at = now()
  where id = p_group_id
  returning * into v_row;

  return v_row;
end;
$$;

-- profiles' own RLS only lets a user select their own row (see the
-- profiles migration), so rendering a roster of usernames/display names for
-- other members needs the same security-definer escape hatch Milestone 3
-- used for get_profiles_for_relations -- gated here by "caller is themselves
-- a member of this specific group" instead of "has a friendships row".
create function public.get_group_member_profiles (p_group_id uuid) returns table (id uuid, username text, display_name text) language sql stable security definer
set
  search_path = '' as $$
  select p.id, p.username, p.display_name
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and p.deleted_at is null
    and exists (
      select 1 from public.group_members self
      where self.group_id = p_group_id and self.user_id = auth.uid()
    );
$$;

revoke execute on function public.create_group (text)
from
  public;

revoke execute on function public.invite_to_group (uuid, uuid)
from
  public;

revoke execute on function public.respond_to_group_invite (uuid, boolean)
from
  public;

revoke execute on function public.leave_group (uuid)
from
  public;

revoke execute on function public.remove_member (uuid, uuid)
from
  public;

revoke execute on function public.archive_group (uuid)
from
  public;

revoke execute on function public.get_group_member_profiles (uuid)
from
  public;

grant
execute on function public.create_group (text) to authenticated;

grant
execute on function public.invite_to_group (uuid, uuid) to authenticated;

grant
execute on function public.respond_to_group_invite (uuid, boolean) to authenticated;

grant
execute on function public.leave_group (uuid) to authenticated;

grant
execute on function public.remove_member (uuid, uuid) to authenticated;

grant
execute on function public.archive_group (uuid) to authenticated;

grant
execute on function public.get_group_member_profiles (uuid) to authenticated;
