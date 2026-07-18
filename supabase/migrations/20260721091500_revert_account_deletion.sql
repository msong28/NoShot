-- Reverts 20260721090000_account_deletion.sql, which was pushed to
-- noshot-dev by mistake -- Milestone 14 (account deletion & privacy) is the
-- cofounder's to build on his own branch, not part of this session's work.
-- Dropping the trigger and functions it added so the live database matches
-- what's in the repo again.
drop trigger if exists profiles_guard_deletion on public.profiles;

drop function if exists public.profiles_guard_deletion ();

drop function if exists public.delete_account_request ();
