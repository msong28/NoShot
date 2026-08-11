-- A built-in "Money" currency, so the create-a-bet screen's "money" stake can
-- flow through the existing bet engine (create_or_counter_bet stakes every bet
-- in a currencies row) instead of a separate wagers table.
--
-- This deliberately reintroduces money as a stake, which PRD §5.1 excludes --
-- kept per an explicit product decision to preserve the "Money" option the
-- create screen offers. Fixed id so the client can reference it directly
-- (web/src/lib/currency.ts MONEY_CURRENCY_ID) rather than matching a mutable
-- name. Category 'points' since the enum has no 'money' value (and shouldn't).
--
-- The currencies_before_insert trigger forces is_builtin := false only for the
-- anon/authenticated roles; a migration (or SQL-editor) insert runs as a
-- trusted role and is exempt, same as this table's original built-in seed.
insert into
  public.currencies (id, name, category, icon, is_builtin, moderation_status)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'Money',
    'points',
    '💵',
    true,
    'approved'
  )
on conflict (id) do nothing;
