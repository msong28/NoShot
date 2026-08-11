-- Security-review follow-up: only username search had per-user rate
-- limiting (username_search_log, 20/min). Bet creation, friend requests,
-- group invites, chat messages, and comments had none -- a malicious
-- authenticated user could spam any of them with nothing in the backend
-- slowing them down beyond Supabase's generic platform-level limits.
--
-- One shared log table + one shared enforcement function, rather than a
-- bespoke `_log` table per action (username_search_log's original
-- approach) -- five more one-off tables would be a lot of near-identical
-- schema for what's fundamentally the same sliding-window check with a
-- different action name/threshold/window each time.
create table public.rate_limit_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_log_user_action_time_idx on public.rate_limit_log (user_id, action, created_at);

alter table public.rate_limit_log enable row level security;

-- Internal bookkeeping only, same as username_search_log -- no client reads
-- or writes it directly, only enforce_rate_limit() below does.
revoke all on public.rate_limit_log
from
  anon,
  authenticated;

create function public.enforce_rate_limit (p_action text, p_max_count integer, p_window interval) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select count(*) into v_recent_count
  from public.rate_limit_log
  where user_id = auth.uid()
    and action = p_action
    and created_at > now() - p_window;

  if v_recent_count >= p_max_count then
    raise exception 'too many requests, please wait a moment and try again';
  end if;

  insert into public.rate_limit_log (user_id, action) values (auth.uid(), p_action);
end;
$$;

-- Deliberately not granted to authenticated/anon -- only called from
-- within the other SECURITY DEFINER function bodies below, never directly
-- by a client (same shape as is_blocked_pair()/is_admin()).
revoke execute on function public.enforce_rate_limit (text, integer, interval)
from
  public;

create or replace function public.create_or_counter_bet (
  p_bet_id uuid,
  p_group_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz,
  p_resolution_method public.bet_resolution_method,
  p_judge_id uuid,
  p_random_fallback_enabled boolean,
  p_sides jsonb,
  p_participants jsonb,
  p_is_draft boolean default false
) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
  v_version_no integer;
  v_side jsonb;
  v_side_ids jsonb := '{}'::jsonb;
  v_side_id uuid;
  v_commitment jsonb;
  v_currency_id uuid;
  v_first_currency uuid;
  v_participant_id uuid;
  v_payout numeric;
  v_outcome_key text;
  v_winner_payout numeric;
  v_loser_pool numeric;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('create_bet', 10, interval '1 hour');
  if jsonb_array_length(p_sides) < 2 then
    raise exception 'a bet needs at least two possible outcomes';
  end if;
  if jsonb_array_length(p_participants) < 2 then
    raise exception 'a bet needs at least two participants';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_participants) a
    cross join jsonb_array_elements(p_participants) b
    where (a ->> 'user_id')::uuid <> (b ->> 'user_id')::uuid
      and public.is_blocked_pair((a ->> 'user_id')::uuid, (b ->> 'user_id')::uuid)
  ) then
    raise exception 'this bet includes participants who have blocked each other';
  end if;
  if public.moderate_text(p_title) = 'block' or public.moderate_text(coalesce(p_description, '')) = 'block' then
    raise exception 'that bet''s title or description isn''t allowed';
  end if;

  if p_bet_id is null then
    if not exists (
      select 1 from jsonb_array_elements(p_participants) elem
      where (elem ->> 'user_id')::uuid = auth.uid()
    ) then
      raise exception 'the creator must be a participant';
    end if;
    if p_group_id is not null and not exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'you must be an active member of that group';
    end if;

    insert into public.bets (
      creator_id, group_id, title, description, current_version, status,
      deadline, resolution_method, judge_id, random_fallback_enabled
    )
    values (
      auth.uid(), p_group_id, trim(p_title), coalesce(p_description, ''), 1,
      (case when p_is_draft then 'draft' else 'pending_acceptance' end)::public.bet_status,
      p_deadline, p_resolution_method, p_judge_id, coalesce(p_random_fallback_enabled, false)
    )
    returning * into v_bet;

    v_version_no := 1;
  else
    select * into v_bet from public.bets where id = p_bet_id;
    if v_bet.id is null then
      raise exception 'bet not found';
    end if;
    if not exists (
      select 1 from public.bet_participants where bet_id = p_bet_id and user_id = auth.uid()
    ) then
      raise exception 'only a participant can propose a counteroffer';
    end if;
    if v_bet.status not in ('draft', 'pending_acceptance', 'active') then
      raise exception 'this bet can no longer be renegotiated';
    end if;

    v_version_no := v_bet.current_version + 1;

    update public.bets
    set title = trim(p_title),
        description = coalesce(p_description, ''),
        current_version = v_version_no,
        status = (case when p_is_draft then 'draft' else 'pending_acceptance' end)::public.bet_status,
        deadline = p_deadline,
        resolution_method = p_resolution_method,
        judge_id = p_judge_id,
        random_fallback_enabled = coalesce(p_random_fallback_enabled, false)
    where id = p_bet_id
    returning * into v_bet;
  end if;

  insert into public.bet_versions (bet_id, version_no, status, created_by, supersedes_version)
  values (
    v_bet.id, v_version_no,
    (case when p_is_draft then 'draft' else 'proposed' end)::public.bet_version_status,
    auth.uid(), nullif(v_version_no - 1, 0)
  );

  for v_side in select jsonb_array_elements(p_sides) loop
    insert into public.bet_sides (bet_id, version_no, label, outcome_key)
    values (v_bet.id, v_version_no, v_side ->> 'label', v_side ->> 'outcome_key')
    returning id into v_side_id;
    v_side_ids := v_side_ids || jsonb_build_object(v_side ->> 'outcome_key', v_side_id::text);
  end loop;

  v_first_currency := null;
  for v_commitment in select jsonb_array_elements(p_participants) loop
    v_currency_id := (v_commitment ->> 'currency_id')::uuid;
    if v_first_currency is null then
      v_first_currency := v_currency_id;
    elsif v_currency_id <> v_first_currency then
      raise exception 'all commitments in a bet must use the same currency';
    end if;
    if not exists (
      select 1 from public.currencies c
      where c.id = v_currency_id
        and c.moderation_status = 'approved'
        and (
          c.is_builtin
          or c.owner_user_id = v_bet.creator_id
          or (c.group_id is not null and c.group_id = v_bet.group_id)
        )
    ) then
      raise exception 'that currency is not available for this bet';
    end if;
    if v_side_ids ->> (v_commitment ->> 'outcome_key') is null then
      raise exception 'unknown outcome for a participant''s commitment';
    end if;

    insert into public.bet_participants (bet_id, user_id, side_id, role)
    values (
      v_bet.id,
      (v_commitment ->> 'user_id')::uuid,
      (v_side_ids ->> (v_commitment ->> 'outcome_key'))::uuid,
      (case when (v_commitment ->> 'user_id')::uuid = v_bet.creator_id then 'creator' else 'participant' end)::public.bet_participant_role
    )
    on conflict (bet_id, user_id) do update
    set side_id = excluded.side_id,
        participation_status = 'active'
    returning id into v_participant_id;

    v_payout := (v_commitment ->> 'stake_quantity')::numeric
      * (v_commitment ->> 'odds_denominator')::numeric
      / (v_commitment ->> 'odds_numerator')::numeric;

    insert into public.bet_commitments (
      bet_id, version_no, participant_id, currency_id, stake_quantity,
      odds_numerator, odds_denominator, payout_if_win
    )
    values (
      v_bet.id, v_version_no, v_participant_id, v_currency_id,
      (v_commitment ->> 'stake_quantity')::numeric,
      (v_commitment ->> 'odds_numerator')::integer,
      (v_commitment ->> 'odds_denominator')::integer,
      v_payout
    );
  end loop;

  -- BET-05: for every possible winning side, its payouts must not exceed
  -- what every other side has staked.
  for v_outcome_key in select jsonb_object_keys(v_side_ids) loop
    select coalesce(sum(bc.payout_if_win), 0) into v_winner_payout
    from public.bet_commitments bc
    join public.bet_participants bp on bp.id = bc.participant_id
    join public.bet_sides bs on bs.id = bp.side_id
    where bc.bet_id = v_bet.id and bc.version_no = v_version_no and bs.outcome_key = v_outcome_key;

    select coalesce(sum(bc.stake_quantity), 0) into v_loser_pool
    from public.bet_commitments bc
    join public.bet_participants bp on bp.id = bc.participant_id
    join public.bet_sides bs on bs.id = bp.side_id
    where bc.bet_id = v_bet.id and bc.version_no = v_version_no and bs.outcome_key <> v_outcome_key;

    if v_winner_payout > v_loser_pool then
      raise exception 'the payout if "%" wins exceeds what everyone else has staked', v_outcome_key;
    end if;
  end loop;

  -- Proposing implicitly approves your own proposal -- you clearly agree to
  -- terms you just wrote. Skipped for drafts, which aren't awaiting approval.
  if not p_is_draft then
    insert into public.bet_approvals (bet_id, version_no, user_id, decision)
    values (v_bet.id, v_version_no, auth.uid(), 'approved');
  end if;

  return v_bet;
end;
$$;

create or replace function public.send_friend_request (p_addressee_id uuid) returns public.friendships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.friendships;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('friend_request', 20, interval '1 hour');
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

create or replace function public.invite_to_group (p_group_id uuid, p_user_id uuid) returns public.group_members language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.group_members;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('group_invite', 20, interval '1 hour');
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

create or replace function public.post_comment (p_bet_id uuid, p_body text) returns public.comments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.comments;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('comment', 30, interval '1 minute');
  if char_length(trim(coalesce(p_body, ''))) < 1 or char_length(p_body) > 1000 then
    raise exception 'comment must be between 1 and 1000 characters';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid()
  ) then
    raise exception 'only a participant can comment on this bet';
  end if;
  if exists (
    select 1 from public.bet_participants bp
    where bp.bet_id = p_bet_id
      and bp.user_id <> auth.uid()
      and public.is_blocked_pair(auth.uid(), bp.user_id)
  ) then
    raise exception 'you cannot interact with this bet due to a block';
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

create or replace function public.post_chat_message (p_group_id uuid, p_body text) returns public.chat_messages language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.chat_messages;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('chat_message', 30, interval '1 minute');
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
