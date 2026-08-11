-- Notifications preference (Settings screen "Notifications" toggle). A
-- plain profile field, not a push-notification system -- there's still no
-- APNs/FCM integration; this just persists whether the user *wants* them,
-- for whenever that infra exists. Self-updatable via the existing
-- profiles_update_own RLS policy (see 20260714120000_profiles.sql) -- no
-- new policy or RPC needed, this is metadata-only on Postgres 11+ even on
-- a populated table.
alter table public.profiles
add column notifications_enabled boolean not null default true;
