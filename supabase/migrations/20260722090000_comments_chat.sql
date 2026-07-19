-- Comments & group chat (Milestone 12 / SOC-01, SOC-02).
--
-- content_moderation_status mirrors currency_moderation_status's own three
-- tiers (approved/pending_review/blocked) from Milestone 5 -- a separate
-- type rather than reusing that one, since comments/chat/proof aren't
-- conceptually currencies, but the same moderate_text() filter (also from
-- Milestone 5, written generically for exactly this reuse) drives it.
--
-- Scope note: the PRD's own `comments` schema has both bet_id and group_id
-- nullable, implying group-level comment threads could exist alongside
-- chat. Nothing in the functional requirements (SOC-01, GR-04) actually
-- asks for that, though -- SOC-01 only names a per-bet thread, and GR-04's
-- own list of what a group overview shows ("recent activity, chat, and
-- polls") doesn't include comments. Scoped to bet-only for now, matching
-- what's actually required; a group_id column can be added later without
-- disturbing this one the way BAL-05's allocation batching was kept general
-- from the start (that one had explicit textual support, this doesn't).
create type public.content_moderation_status as enum ('approved', 'pending_review', 'blocked');

create table public.comments (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  moderation_status public.content_moderation_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint comments_body_length check (char_length(trim(body)) between 1 and 1000)
);

create index comments_bet_idx on public.comments (bet_id, created_at);

alter table public.comments enable row level security;

revoke all on public.comments
from
  anon;

-- Read-only direct access, same as every other RPC-only table in this app
-- (ARCHITECTURE.md §6) -- writes go through post_comment() below, which
-- applies moderation and participant validation atomically.
grant
select
  on public.comments to authenticated;

-- Visible to bet participants, and (matching GR-05's precedent for proof on
-- group-scoped bets) to any member of the bet's group too -- a comment
-- thread is exactly the kind of "recent activity" a group should be able to
-- follow even before joining a specific bet.
create policy comments_select on public.comments for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
    or bet_id in (
      select id
      from public.bets
      where
        group_id in (
          select
            public.get_my_group_ids ()
        )
    )
  );

-- Unlike viewing, posting stays participant-only -- the same actor set
-- allowed to submit/confirm results, not the wider group.
create function public.post_comment (p_bet_id uuid, p_body text) returns public.comments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.comments;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 or char_length(p_body) > 1000 then
    raise exception 'comment must be between 1 and 1000 characters';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid()
  ) then
    raise exception 'only a participant can comment on this bet';
  end if;

  v_tier := public.moderate_text(p_body);
  if v_tier = 'block' then
    raise exception 'that comment isn''t allowed';
  end if;

  insert into public.comments (bet_id, author_id, body, moderation_status)
  values (
    p_bet_id, auth.uid(), trim(p_body),
    (case when v_tier = 'warn' then 'pending_review' else 'approved' end)::public.content_moderation_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.post_comment (uuid, text)
from
  public;

grant
execute on function public.post_comment (uuid, text) to authenticated;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid (),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  moderation_status public.content_moderation_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint chat_messages_body_length check (char_length(trim(body)) between 1 and 1000)
);

create index chat_messages_group_idx on public.chat_messages (group_id, created_at);

alter table public.chat_messages enable row level security;

revoke all on public.chat_messages
from
  anon;

grant
select
  on public.chat_messages to authenticated;

create policy chat_messages_select on public.chat_messages for
select
  to authenticated using (
    group_id in (
      select
        public.get_my_group_ids ()
    )
  );

-- Posting requires *active* membership specifically (unlike the broader
-- get_my_group_ids() read scope) -- matches every other group-scoped write
-- in this codebase (e.g. group-scoped currency creation's own status =
-- 'active' check).
create function public.post_chat_message (p_group_id uuid, p_body text) returns public.chat_messages language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.chat_messages;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 or char_length(p_body) > 1000 then
    raise exception 'message must be between 1 and 1000 characters';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'you must be an active member of this group';
  end if;

  v_tier := public.moderate_text(p_body);
  if v_tier = 'block' then
    raise exception 'that message isn''t allowed';
  end if;

  insert into public.chat_messages (group_id, author_id, body, moderation_status)
  values (
    p_group_id, auth.uid(), trim(p_body),
    (case when v_tier = 'warn' then 'pending_review' else 'approved' end)::public.content_moderation_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.post_chat_message (uuid, text)
from
  public;

grant
execute on function public.post_chat_message (uuid, text) to authenticated;

-- SOC-02's "real-time" requirement: Realtime evaluates each subscriber's own
-- RLS on postgres_changes, so adding the table to the publication is the
-- only extra step needed -- chat_messages_select above already scopes each
-- subscriber to their own groups. Comments/polls deliberately don't get this
-- (no SOC requirement calls for live push there); they use the same
-- invalidate-on-mutation refresh as everything else in this app.
alter publication supabase_realtime
add table public.chat_messages;
