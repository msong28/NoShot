-- Polls (Milestone 12 / SOC-03). Unlike comments, the PRD is explicit that
-- polls are genuinely group-OR-bet scoped ("Support polls attached to a bet
-- and polls posted to group chat") -- so, unlike comments, both variants are
-- built here, not narrowed to one.
create table public.polls (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid references public.bets (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  allow_multiple boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint polls_question_length check (char_length(trim(question)) between 1 and 200),
  constraint polls_scope check (
    (bet_id is not null)::int + (group_id is not null)::int = 1
  )
);

create index polls_bet_idx on public.polls (bet_id);

create index polls_group_idx on public.polls (group_id);

create table public.poll_options (
  id uuid primary key default gen_random_uuid (),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null,
  position integer not null,
  constraint poll_options_label_length check (char_length(trim(label)) between 1 and 100)
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid (),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint poll_votes_unique_choice unique (poll_id, option_id, voter_id)
);

create index poll_votes_poll_idx on public.poll_votes (poll_id);

alter table public.polls enable row level security;

alter table public.poll_options enable row level security;

alter table public.poll_votes enable row level security;

revoke all on public.polls
from
  anon;

revoke all on public.poll_options
from
  anon;

revoke all on public.poll_votes
from
  anon;

-- Read-only direct access; writes go through create_poll()/vote_on_poll()/
-- close_poll() below, same RPC-only convention as comments/chat.
grant
select
  on public.polls to authenticated;

grant
select
  on public.poll_options to authenticated;

grant
select
  on public.poll_votes to authenticated;

-- Same visibility shape as comments: bet-scoped polls are visible to
-- participants and (per GR-05's precedent) the bet's group; group-scoped
-- polls are visible to the group.
create policy polls_select on public.polls for
select
  to authenticated using (
    (
      bet_id is not null
      and (
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
      )
    )
    or (
      group_id is not null
      and group_id in (
        select
          public.get_my_group_ids ()
      )
    )
  );

create policy poll_options_select on public.poll_options for
select
  to authenticated using (
    poll_id in (
      select id
      from public.polls
    )
  );

-- Votes are not anonymous -- same precedent as bet_dispute_votes (Milestone
-- 8), visible to the same audience as the poll itself.
create policy poll_votes_select on public.poll_votes for
select
  to authenticated using (
    poll_id in (
      select id
      from public.polls
    )
  );

-- p_options: text[] of at least two option labels. Exactly one of p_bet_id/
-- p_group_id must be set.
create function public.create_poll (
  p_bet_id uuid,
  p_group_id uuid,
  p_question text,
  p_options text[],
  p_allow_multiple boolean default false
) returns public.polls language plpgsql security definer
set
  search_path = '' as $$
declare
  v_poll public.polls;
  v_tier text;
  v_label text;
  v_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if (p_bet_id is not null)::int + (p_group_id is not null)::int <> 1 then
    raise exception 'a poll needs exactly one of a bet or a group';
  end if;
  if char_length(trim(coalesce(p_question, ''))) < 1 or char_length(p_question) > 200 then
    raise exception 'question must be between 1 and 200 characters';
  end if;
  if p_options is null or array_length(p_options, 1) < 2 then
    raise exception 'a poll needs at least two options';
  end if;

  if p_bet_id is not null then
    if not exists (
      select 1 from public.bet_participants
      where bet_id = p_bet_id and user_id = auth.uid()
    ) then
      raise exception 'only a participant can create a poll on this bet';
    end if;
  else
    if not exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'you must be an active member of this group';
    end if;
  end if;

  v_tier := public.moderate_text(p_question);
  if v_tier = 'block' then
    raise exception 'that question isn''t allowed';
  end if;

  insert into public.polls (bet_id, group_id, creator_id, question, allow_multiple)
  values (p_bet_id, p_group_id, auth.uid(), trim(p_question), coalesce(p_allow_multiple, false))
  returning * into v_poll;

  foreach v_label in array p_options
  loop
    if char_length(trim(coalesce(v_label, ''))) < 1 or char_length(v_label) > 100 then
      raise exception 'each option must be between 1 and 100 characters';
    end if;
    insert into public.poll_options (poll_id, label, position)
    values (v_poll.id, trim(v_label), v_position);
    v_position := v_position + 1;
  end loop;

  return v_poll;
end;
$$;

revoke execute on function public.create_poll (uuid, uuid, text, text[], boolean)
from
  public;

grant
execute on function public.create_poll (uuid, uuid, text, text[], boolean) to authenticated;

-- Re-voting when allow_multiple is false replaces the caller's existing
-- vote (delete-then-insert) rather than rejecting it -- friendlier than
-- forcing an explicit "retract" step first, and voting for the same option
-- again is a harmless no-op either way.
create function public.vote_on_poll (p_poll_id uuid, p_option_id uuid) returns public.poll_votes language plpgsql security definer
set
  search_path = '' as $$
declare
  v_poll public.polls;
  v_row public.poll_votes;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then
    raise exception 'poll not found';
  end if;
  if v_poll.closed_at is not null then
    raise exception 'this poll is closed';
  end if;
  if not exists (select 1 from public.poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'that option does not belong to this poll';
  end if;

  if v_poll.bet_id is not null then
    if not exists (
      select 1 from public.bet_participants
      where bet_id = v_poll.bet_id and user_id = auth.uid()
    ) then
      raise exception 'only a participant can vote on this poll';
    end if;
  else
    if not exists (
      select 1 from public.group_members
      where group_id = v_poll.group_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'you must be an active member of this group';
    end if;
  end if;

  if not v_poll.allow_multiple then
    delete from public.poll_votes where poll_id = p_poll_id and voter_id = auth.uid();
  end if;

  insert into public.poll_votes (poll_id, option_id, voter_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, option_id, voter_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.poll_votes
    where poll_id = p_poll_id and option_id = p_option_id and voter_id = auth.uid();
  end if;

  return v_row;
end;
$$;

revoke execute on function public.vote_on_poll (uuid, uuid)
from
  public;

grant
execute on function public.vote_on_poll (uuid, uuid) to authenticated;

create function public.close_poll (p_poll_id uuid) returns public.polls language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.polls;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.polls
  set closed_at = now()
  where id = p_poll_id and creator_id = auth.uid() and closed_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no open poll found for you to close';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.close_poll (uuid)
from
  public;

grant
execute on function public.close_poll (uuid) to authenticated;
