-- Friends, blocks, and username search (Milestone 3 / FR-01..05).
--
-- All mutations go through SECURITY DEFINER functions below, not direct
-- table writes -- this is where block-enforcement ("blocks override
-- friendship, invitations, chats, and future discovery", FR-05) and the
-- one-active-relationship-per-pair rule are centrally enforced, instead of
-- being duplicated across every future feature that touches friendships.
create type public.friendship_status as enum ('pending', 'accepted', 'declined', 'cancelled');

create table public.friendships (
  id uuid primary key default gen_random_uuid (),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- At most one active (pending/accepted) relationship per normalized pair.
-- A prior declined/cancelled row doesn't block a fresh request later.
create unique index friendships_unique_active_pair_idx on public.friendships (least (requester_id, addressee_id), greatest (requester_id, addressee_id))
where
  status in ('pending', 'accepted');

create index friendships_requester_idx on public.friendships (requester_id);

create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.blocks (
  id uuid primary key default gen_random_uuid (),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_no_self check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- Search rate-limit bookkeeping (FR-01: "privacy-aware rate limits").
-- Internal only -- no grants to any client role, touched solely by
-- search_profiles_by_username() below.
create table public.username_search_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  searched_at timestamptz not null default now()
);

create index username_search_log_user_time_idx on public.username_search_log (user_id, searched_at);

alter table public.friendships enable row level security;

alter table public.blocks enable row level security;

alter table public.username_search_log enable row level security;

revoke all on public.friendships
from
  anon;

revoke all on public.blocks
from
  anon;

revoke all on public.username_search_log
from
  anon,
  authenticated;

-- Read-only direct access; every write happens inside the functions below.
grant
select
  on public.friendships to authenticated;

grant
select
  on public.blocks to authenticated;

create policy friendships_select_own on public.friendships for
select
  to authenticated using (
    requester_id = auth.uid ()
    or addressee_id = auth.uid ()
  );

create policy blocks_select_own on public.blocks for
select
  to authenticated using (blocker_id = auth.uid ());

-- security definer: must see blocks in both directions, which the
-- blocks_select_own RLS policy above (blocker_id = auth.uid() only) would
-- otherwise hide when the caller is the blocked_id side of the pair.
create function public.is_blocked_pair (a uuid, b uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create function public.send_friend_request (p_addressee_id uuid) returns public.friendships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.friendships;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_addressee_id = auth.uid() then
    raise exception 'cannot send a friend request to yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_addressee_id and deleted_at is null) then
    raise exception 'user not found';
  end if;
  if public.is_blocked_pair(auth.uid(), p_addressee_id) then
    raise exception 'cannot send a friend request to this user';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), p_addressee_id, 'pending')
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'a pending or accepted friendship with this user already exists';
end;
$$;

create function public.respond_friend_request (p_friendship_id uuid, p_accept boolean) returns public.friendships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.friendships;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.friendships
  set status = (case when p_accept then 'accepted' else 'declined' end)::public.friendship_status,
      responded_at = now()
  where id = p_friendship_id
    and addressee_id = auth.uid()
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending friend request found for you with that id';
  end if;

  return v_row;
end;
$$;

create function public.cancel_friend_request (p_friendship_id uuid) returns public.friendships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.friendships;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.friendships
  set status = 'cancelled',
      responded_at = now()
  where id = p_friendship_id
    and requester_id = auth.uid()
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pending friend request found from you with that id';
  end if;

  return v_row;
end;
$$;

create function public.block_user (p_blocked_id uuid) returns public.blocks language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.blocks;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_blocked_id = auth.uid() then
    raise exception 'cannot block yourself';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.blocks
    where blocker_id = auth.uid() and blocked_id = p_blocked_id;
  end if;

  -- Blocking overrides any active friendship between the two users (FR-05).
  update public.friendships
  set status = 'cancelled',
      responded_at = now()
  where status in ('pending', 'accepted')
    and (
      (requester_id = auth.uid() and addressee_id = p_blocked_id)
      or (requester_id = p_blocked_id and addressee_id = auth.uid())
    );

  return v_row;
end;
$$;

create function public.unblock_user (p_blocked_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  delete from public.blocks
  where blocker_id = auth.uid() and blocked_id = p_blocked_id;
end;
$$;

-- Returns only the minimal public-safe fields, and only for ids the caller
-- already has a friendships row with (any status) -- not a general-purpose
-- profile lookup. Used to render names on the Friends/Activity screens.
create function public.get_profiles_for_relations (p_ids uuid[]) returns table (id uuid, username text, display_name text) language sql stable security definer
set
  search_path = '' as $$
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.id = any (p_ids)
    and p.deleted_at is null
    and exists (
      select 1 from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = p.id)
         or (f.addressee_id = auth.uid() and f.requester_id = p.id)
    );
$$;

-- Sanitized invite-link preview (FR-04): callable by anon, since a
-- non-user must be able to preview an invite before creating an account.
-- Only an exact, already-known username works -- unlike the search
-- function below, this can't be used to enumerate usernames by prefix.
create function public.get_invite_preview (p_username text) returns table (id uuid, username text, display_name text) language sql stable security definer
set
  search_path = '' as $$
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.username = lower(trim(p_username))
    and p.deleted_at is null
  limit 1;
$$;

-- Prefix search with a simple sliding-window rate limit and block filtering.
create function public.search_profiles_by_username (p_query text) returns table (id uuid, username text, display_name text) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if length(trim(p_query)) < 3 then
    raise exception 'query must be at least 3 characters';
  end if;

  select count(*) into v_recent_count
  from public.username_search_log
  where user_id = auth.uid()
    and searched_at > now() - interval '1 minute';

  if v_recent_count >= 20 then
    raise exception 'too many searches, please wait a moment and try again';
  end if;

  insert into public.username_search_log (user_id) values (auth.uid());

  return query
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.deleted_at is null
    and p.id <> auth.uid()
    and p.username like lower(trim(p_query)) || '%'
    and not public.is_blocked_pair(auth.uid(), p.id)
  order by p.username
  limit 20;
end;
$$;

revoke execute on function public.is_blocked_pair (uuid, uuid)
from
  public;

revoke execute on function public.send_friend_request (uuid)
from
  public;

revoke execute on function public.respond_friend_request (uuid, boolean)
from
  public;

revoke execute on function public.cancel_friend_request (uuid)
from
  public;

revoke execute on function public.block_user (uuid)
from
  public;

revoke execute on function public.unblock_user (uuid)
from
  public;

revoke execute on function public.get_profiles_for_relations (uuid[])
from
  public;

revoke execute on function public.get_invite_preview (text)
from
  public;

revoke execute on function public.search_profiles_by_username (text)
from
  public;

grant
execute on function public.send_friend_request (uuid) to authenticated;

grant
execute on function public.respond_friend_request (uuid, boolean) to authenticated;

grant
execute on function public.cancel_friend_request (uuid) to authenticated;

grant
execute on function public.block_user (uuid) to authenticated;

grant
execute on function public.unblock_user (uuid) to authenticated;

grant
execute on function public.get_profiles_for_relations (uuid[]) to authenticated;

grant
execute on function public.get_invite_preview (text) to anon,
authenticated;

grant
execute on function public.search_profiles_by_username (text) to authenticated;
