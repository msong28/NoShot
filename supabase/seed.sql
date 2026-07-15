-- Local development seed data only. Never run this against a real/prod
-- project. Applied automatically by `supabase db reset` against your local
-- Supabase stack (started with `supabase start`).
insert into
  auth.users (id, email)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'alice@example.com'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'bob@example.com'
  ) on conflict (id) do nothing;

insert into
  public.profiles (
    id,
    username,
    display_name,
    birth_year,
    age_acknowledged_at
  )
values
  (
    '00000000-0000-0000-0000-000000000001',
    'alice',
    'Alice',
    2000,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'bob',
    'Bob',
    1998,
    now()
  ) on conflict (id) do nothing;
