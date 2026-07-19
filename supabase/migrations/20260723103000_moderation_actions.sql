-- Admin dashboard actions & audit log (Milestone 13 / MOD-05, MOD-06).
-- moderation_actions mirrors ledger_entries' append-only shape exactly:
-- BEFORE UPDATE/DELETE triggers that unconditionally raise, no
-- insert/update/delete grant to any client role -- every row is written by
-- one of the SECURITY DEFINER functions below, as the function owner,
-- which bypasses the missing grant the same way _finalize_bet_resolution()
-- and approve_manual_obligation() insert ledger_entries.
create type public.moderation_action_type as enum (
  'remove_content',
  'suspend_user',
  'resolve_report',
  'dismiss_report'
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid (),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  action_type public.moderation_action_type not null,
  -- Snapshotted from the report at the time of the action (not a live join)
  -- so the audit record stays self-contained even if the report row's own
  -- target_type/target_id were ever to change.
  target_type public.report_target_type not null,
  target_id uuid not null,
  note text,
  created_at timestamptz not null default now(),
  constraint moderation_actions_note_length check (
    note is null
    or char_length(note) <= 1000
  )
);

create index moderation_actions_report_idx on public.moderation_actions (report_id);

create function public.moderation_actions_prevent_mutation () returns trigger language plpgsql as $$
begin
  raise exception 'moderation_actions is append-only -- it is a permanent record of admin activity';
end;
$$;

create trigger moderation_actions_no_update before
update on public.moderation_actions for each row
execute function public.moderation_actions_prevent_mutation ();

create trigger moderation_actions_no_delete before delete on public.moderation_actions for each row
execute function public.moderation_actions_prevent_mutation ();

alter table public.moderation_actions enable row level security;

revoke all on public.moderation_actions
from
  anon;

grant
select
  on public.moderation_actions to authenticated;

create policy moderation_actions_select on public.moderation_actions for
select
  to authenticated using (public.is_admin ());

-- Returns the reported content itself as jsonb, bypassing the target
-- table's own RLS (an admin must be able to review a chat message in a
-- group they aren't a member of, a comment on a bet they're not part of,
-- etc.) -- the report queue's only path to viewing evidence.
create function public.get_report_evidence (p_report_id uuid) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_report public.reports;
  v_evidence jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'report not found';
  end if;

  case v_report.target_type
    when 'bet' then
      select jsonb_build_object(
        'title', title, 'description', description, 'status', status, 'creator_id', creator_id
      ) into v_evidence from public.bets where id = v_report.target_id;
    when 'currency' then
      select jsonb_build_object(
        'name', name, 'category', category, 'owner_user_id', owner_user_id,
        'group_id', group_id, 'moderation_status', moderation_status
      ) into v_evidence from public.currencies where id = v_report.target_id;
    when 'comment' then
      select jsonb_build_object(
        'body', body, 'author_id', author_id, 'bet_id', bet_id,
        'moderation_status', moderation_status, 'removed_at', removed_at
      ) into v_evidence from public.comments where id = v_report.target_id;
    when 'chat_message' then
      select jsonb_build_object(
        'body', body, 'author_id', author_id, 'group_id', group_id,
        'moderation_status', moderation_status, 'removed_at', removed_at
      ) into v_evidence from public.chat_messages where id = v_report.target_id;
    when 'proof_asset' then
      select jsonb_build_object(
        'caption', caption, 'uploader_id', uploader_id, 'bet_id', bet_id,
        'storage_path', storage_path, 'moderation_status', moderation_status
      ) into v_evidence from public.proof_assets where id = v_report.target_id;
    when 'user' then
      select jsonb_build_object('username', username, 'display_name', display_name, 'status', status)
      into v_evidence from public.profiles where id = v_report.target_id;
  end case;

  if v_evidence is null then
    raise exception 'the reported content no longer exists';
  end if;

  return v_evidence;
end;
$$;

-- Supports comment/chat_message/proof_asset/currency -- the four target
-- types that already carry a moderation_status column. A bet has no
-- removal concept in scope here (its own state machine is out of bounds),
-- and a user isn't content -- admin_suspend_user() is the right action for
-- a 'bet' or 'user' report.
create function public.admin_remove_content (p_report_id uuid, p_note text default null) returns public.moderation_actions language plpgsql security definer
set
  search_path = '' as $$
declare
  v_report public.reports;
  v_action public.moderation_actions;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'report not found';
  end if;

  case v_report.target_type
    when 'comment' then
      update public.comments set moderation_status = 'blocked', removed_at = now()
      where id = v_report.target_id;
    when 'chat_message' then
      update public.chat_messages set moderation_status = 'blocked', removed_at = now()
      where id = v_report.target_id;
    when 'proof_asset' then
      update public.proof_assets set moderation_status = 'blocked'
      where id = v_report.target_id;
    when 'currency' then
      update public.currencies set moderation_status = 'blocked'
      where id = v_report.target_id;
    else
      raise exception 'content removal isn''t supported for this report type';
  end case;

  insert into public.moderation_actions (admin_id, report_id, action_type, target_type, target_id, note)
  values (
    auth.uid(), v_report.id, 'remove_content', v_report.target_type, v_report.target_id,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_action;

  return v_action;
end;
$$;

-- Resolves the responsible user from the report -- the target itself for a
-- 'user' report, otherwise the content's author/uploader/creator/owner --
-- so suspending applies to whoever is actually accountable, not just
-- direct user reports. No enforcement is wired into bets/currencies/
-- comments/chat/poll RPCs here -- that's blocking enforcement (MOD-02),
-- out of scope for this branch.
create function public.admin_suspend_user (p_report_id uuid, p_note text default null) returns public.moderation_actions language plpgsql security definer
set
  search_path = '' as $$
declare
  v_report public.reports;
  v_target_user_id uuid;
  v_action public.moderation_actions;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'report not found';
  end if;

  case v_report.target_type
    when 'user' then
      v_target_user_id := v_report.target_id;
    when 'comment' then
      select author_id into v_target_user_id from public.comments where id = v_report.target_id;
    when 'chat_message' then
      select author_id into v_target_user_id from public.chat_messages where id = v_report.target_id;
    when 'proof_asset' then
      select uploader_id into v_target_user_id from public.proof_assets where id = v_report.target_id;
    when 'bet' then
      select creator_id into v_target_user_id from public.bets where id = v_report.target_id;
    when 'currency' then
      select owner_user_id into v_target_user_id from public.currencies where id = v_report.target_id;
  end case;

  if v_target_user_id is null then
    raise exception 'no individual user is responsible for this report''s target';
  end if;

  update public.profiles set status = 'suspended' where id = v_target_user_id;

  insert into public.moderation_actions (admin_id, report_id, action_type, target_type, target_id, note)
  values (
    auth.uid(), v_report.id, 'suspend_user', v_report.target_type, v_report.target_id,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_action;

  return v_action;
end;
$$;

create function public.admin_resolve_report (p_report_id uuid, p_note text default null) returns public.reports language plpgsql security definer
set
  search_path = '' as $$
declare
  v_report public.reports;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  update public.reports
  set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_report_id and status = 'open'
  returning * into v_report;

  if v_report.id is null then
    raise exception 'no open report found with that id';
  end if;

  insert into public.moderation_actions (admin_id, report_id, action_type, target_type, target_id, note)
  values (
    auth.uid(), v_report.id, 'resolve_report', v_report.target_type, v_report.target_id,
    nullif(trim(coalesce(p_note, '')), '')
  );

  return v_report;
end;
$$;

create function public.admin_dismiss_report (p_report_id uuid, p_note text default null) returns public.reports language plpgsql security definer
set
  search_path = '' as $$
declare
  v_report public.reports;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  update public.reports
  set status = 'dismissed', resolved_at = now(), resolved_by = auth.uid()
  where id = p_report_id and status = 'open'
  returning * into v_report;

  if v_report.id is null then
    raise exception 'no open report found with that id';
  end if;

  insert into public.moderation_actions (admin_id, report_id, action_type, target_type, target_id, note)
  values (
    auth.uid(), v_report.id, 'dismiss_report', v_report.target_type, v_report.target_id,
    nullif(trim(coalesce(p_note, '')), '')
  );

  return v_report;
end;
$$;

revoke execute on function public.get_report_evidence (uuid)
from
  public;

revoke execute on function public.admin_remove_content (uuid, text)
from
  public;

revoke execute on function public.admin_suspend_user (uuid, text)
from
  public;

revoke execute on function public.admin_resolve_report (uuid, text)
from
  public;

revoke execute on function public.admin_dismiss_report (uuid, text)
from
  public;

grant
execute on function public.get_report_evidence (uuid) to authenticated;

grant
execute on function public.admin_remove_content (uuid, text) to authenticated;

grant
execute on function public.admin_suspend_user (uuid, text) to authenticated;

grant
execute on function public.admin_resolve_report (uuid, text) to authenticated;

grant
execute on function public.admin_dismiss_report (uuid, text) to authenticated;
