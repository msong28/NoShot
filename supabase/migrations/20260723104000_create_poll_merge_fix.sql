-- Merge-integration fix: two branches independently replaced create_poll()
-- for unrelated reasons -- `milestone-13-blocking-enforcement` added the
-- co-participant block check (20260723090000_blocking_enforcement.sql),
-- `milestone-13-trust-safety` added per-option moderation
-- (20260723102000_moderation_gaps.sql, renamed from 092000 during merge).
-- Different filenames, so git didn't conflict, but the second
-- CREATE OR REPLACE FUNCTION to run silently discards whatever the first
-- one added, since neither branch could see the other's changes ahead of
-- time. This migration is the union of both, applied last so it wins.
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
