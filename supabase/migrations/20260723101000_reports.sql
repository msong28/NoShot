-- Reports (Milestone 13 / MOD-01). Covers the 6 reportable surfaces named
-- in the PRD: bets, currencies, comments, chat messages, proof images, and
-- user profiles. target_id is a plain uuid (no FK -- it points into six
-- different tables depending on target_type), so existence is validated
-- inside submit_report() instead of at the schema level.
create type public.report_target_type as enum (
  'bet',
  'currency',
  'comment',
  'chat_message',
  'proof_asset',
  'user'
);

create type public.report_reason as enum (
  'harassment',
  'spam',
  'inappropriate_content',
  'scam_fraud',
  'other'
);

create type public.report_status as enum ('open', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid (),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  constraint reports_details_length check (
    details is null
    or char_length(details) <= 1000
  )
);

create index reports_status_idx on public.reports (status, created_at);

create index reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

revoke all on public.reports
from
  anon;

-- Read-only direct access, same as every other RPC-only table in this app
-- -- writes go through submit_report()/admin_resolve_report()/
-- admin_dismiss_report() below, never a direct grant.
grant
select
  on public.reports to authenticated;

-- A reporter can see their own submitted reports; an admin sees everything.
create policy reports_select on public.reports for
select
  to authenticated using (
    reporter_id = auth.uid ()
    or public.is_admin ()
  );

-- p_target_id is validated against the real table for p_target_type so a
-- report can never point at a nonexistent row.
create function public.submit_report (
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason public.report_reason,
  p_details text default null
) returns public.reports language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.reports;
  v_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_details is not null and char_length(p_details) > 1000 then
    raise exception 'details must be 1000 characters or fewer';
  end if;

  v_exists := case p_target_type
    when 'bet' then exists (select 1 from public.bets where id = p_target_id)
    when 'currency' then exists (select 1 from public.currencies where id = p_target_id)
    when 'comment' then exists (select 1 from public.comments where id = p_target_id)
    when 'chat_message' then exists (select 1 from public.chat_messages where id = p_target_id)
    when 'proof_asset' then exists (select 1 from public.proof_assets where id = p_target_id)
    when 'user' then exists (select 1 from public.profiles where id = p_target_id and deleted_at is null)
  end;

  if not v_exists then
    raise exception 'the thing you''re trying to report no longer exists';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(coalesce(p_details, '')), ''))
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.submit_report (
  public.report_target_type, uuid, public.report_reason, text
)
from
  public;

grant
execute on function public.submit_report (
  public.report_target_type, uuid, public.report_reason, text
) to authenticated;
