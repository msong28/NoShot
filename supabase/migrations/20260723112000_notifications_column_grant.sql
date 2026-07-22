-- 20260722120000_account_deletion.sql tightened profiles' client UPDATE to
-- an explicit column allowlist (display_name, birth_year,
-- age_acknowledged_at) for security. notifications_enabled (added in
-- 20260723110000_notifications_preference.sql) is the same kind of safe,
-- non-security-sensitive self-service field as display_name, so it needs
-- to join that allowlist -- column-level GRANTs are additive, this doesn't
-- touch the existing three.
grant
update (notifications_enabled) on public.profiles to authenticated;
