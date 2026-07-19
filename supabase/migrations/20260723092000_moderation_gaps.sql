-- Content filter audit (Milestone 13 / MOD-03, MOD-04). moderate_text()
-- (Milestone 5) already covers currency names, bet title/description,
-- comments, chat messages, proof captions, and poll questions -- this closes
-- the two remaining gaps: poll options and group names. CREATE OR REPLACE
-- with the same signature, same convention as ledger.sql extending
-- _finalize_bet_resolution()/approve_manual_obligation() -- not an edit of
-- the original migration.
--
-- Both stay block-only, no warn-tier pending_review: neither polls nor
-- groups carry a moderation_status column (unlike comments/chat_messages/
-- proof_assets/currencies), matching how the question check already
-- behaves in create_poll() and how bet titles/descriptions are already
-- checked in create_or_counter_bet().
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
    if public.moderate_text(v_label) = 'block' then
      raise exception 'that option isn''t allowed';
    end if;
    insert into public.poll_options (poll_id, label, position)
    values (v_poll.id, trim(v_label), v_position);
    v_position := v_position + 1;
  end loop;

  return v_poll;
end;
$$;

create or replace function public.create_group (p_name text) returns public.groups language plpgsql security definer
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
  if public.moderate_text(p_name) = 'block' then
    raise exception 'that name isn''t allowed';
  end if;

  insert into public.groups (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_group.id, auth.uid(), 'owner', 'active', now());

  return v_group;
end;
$$;
