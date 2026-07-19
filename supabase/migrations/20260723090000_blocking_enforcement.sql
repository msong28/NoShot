-- Blocking enforcement (Milestone 13 / MOD-02).
--
-- Blocking has existed since Milestone 3 (`blocks`, `is_blocked_pair()`,
-- `block_user()`/`unblock_user()`) and already overrides friendships and
-- group invitations. But nothing built since -- the entire bet engine,
-- comments, chat, and polls -- ever checked it. MOD-02: "Blocking hides
-- content where feasible and prevents new direct interaction." This
-- migration is scoped to exactly those two halves:
--
-- 1. Prevents new direct interaction: a blocked pair can no longer be
--    co-participants on a new bet or counteroffer, and can no longer
--    comment/poll/vote/upload-proof on a bet they're already both on
--    (blocks can happen after a bet already exists). Applied at every
--    write path that creates bet-scoped social content.
-- 2. Hides content where feasible: scoped to group chat specifically,
--    since that's the one surface the PRD explicitly names ("Block
--    relationships override friendship, invitations, chats, and future
--    discovery" -- groups_membership.sql's own comment, Milestone 4).
--
-- Deliberately NOT retroactively hiding bets/comments/polls/proof
-- wholesale: a bet's ledger entries are the "preserve minimal
-- pseudonymized... history" the account-deletion work (Milestone 14) was
-- careful about too -- hiding a whole bet because its creator later blocks
-- a co-participant would hide a real, still-owed obligation. Only the new
-- creation of shared content is what actually needs stopping.
--
-- is_blocked_pair() was never callable directly by authenticated clients
-- (only from inside other SECURITY DEFINER function bodies, which execute
-- as the owner) -- using it inside an RLS policy's USING clause runs as
-- the querying role itself, so it needs its own direct grant now.
grant
execute on function public.is_blocked_pair (uuid, uuid) to authenticated;

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

create or replace function public.create_poll (
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
    if exists (
      select 1 from public.bet_participants bp
      where bp.bet_id = p_bet_id
        and bp.user_id <> auth.uid()
        and public.is_blocked_pair(auth.uid(), bp.user_id)
    ) then
      raise exception 'you cannot interact with this bet due to a block';
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

create or replace function public.vote_on_poll (p_poll_id uuid, p_option_id uuid) returns public.poll_votes language plpgsql security definer
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
    if exists (
      select 1 from public.bet_participants bp
      where bp.bet_id = v_poll.bet_id
        and bp.user_id <> auth.uid()
        and public.is_blocked_pair(auth.uid(), bp.user_id)
    ) then
      raise exception 'you cannot interact with this bet due to a block';
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

create or replace function public.upload_proof (
  p_bet_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_caption text default null
) returns public.proof_assets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.proof_assets;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid()
  ) then
    raise exception 'only a participant can upload proof for this bet';
  end if;
  if exists (
    select 1 from public.bet_participants bp
    where bp.bet_id = p_bet_id
      and bp.user_id <> auth.uid()
      and public.is_blocked_pair(auth.uid(), bp.user_id)
  ) then
    raise exception 'you cannot interact with this bet due to a block';
  end if;
  if p_storage_path not like (p_bet_id::text || '/%') then
    raise exception 'storage path must be scoped to this bet';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'unsupported image type';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'image must be between 1 byte and 10MB';
  end if;

  if p_caption is not null then
    if char_length(p_caption) > 500 then
      raise exception 'caption must be 500 characters or fewer';
    end if;
    v_tier := public.moderate_text(p_caption);
    if v_tier = 'block' then
      raise exception 'that caption isn''t allowed';
    end if;
  end if;

  insert into public.proof_assets (
    bet_id, uploader_id, storage_path, mime_type, size_bytes, caption, moderation_status
  )
  values (
    p_bet_id, auth.uid(), p_storage_path, p_mime_type, p_size_bytes, nullif(trim(coalesce(p_caption, '')), ''),
    (case when v_tier = 'warn' then 'pending_review' else 'approved' end)::public.content_moderation_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Hides content where feasible (MOD-02): groups_membership.sql's own
-- comment already documented that block relationships are meant to
-- override chat, but chat_messages_select never actually checked it.
alter policy chat_messages_select on public.chat_messages using (
  group_id in (
    select
      public.get_my_group_ids ()
  )
  and not public.is_blocked_pair (auth.uid (), author_id)
);
