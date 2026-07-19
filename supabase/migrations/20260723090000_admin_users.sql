-- Admin roster (Milestone 13 / MOD-05). Admin status lives here, checked
-- server-side via is_admin() below -- never inferred from email or any
-- client-editable field (ARCHITECTURE.md §6/§7).
--
-- No self-serve path to become an admin: zero grants to any client role.
-- The first admin is a one-time manual insert run directly against the
-- project (documented in PROJECT_STATUS.md), the same way a brand-new
-- Supabase project has no users until someone signs one up out-of-band.
create table public.admin_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on public.admin_users
from
  anon,
  authenticated;

-- security definer: lets any authenticated caller cheaply check their own
-- admin status without needing a SELECT grant on admin_users itself, the
-- same shape as is_blocked_pair()/get_profiles_for_relations() working
-- around a table with no direct client access.
create function public.is_admin () returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin ()
from
  public;

grant
execute on function public.is_admin () to authenticated;
