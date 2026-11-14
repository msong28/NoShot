-- Drop the orphaned wagers table family (20260725033155_wagers.sql).
--
-- The create flow moved back onto the bets engine ("Path B",
-- 20260725050000_money_stake_currency.sql, web/src/lib/wager.ts
-- buildBetInput()), so nothing has written to `wagers` since; the only reader
-- was the unlinked /my-wagers screen, removed in the same change. Any rows
-- still here were never visible as bets to the other person, never accepted,
-- and never touched the ledger.
--
-- Irreversible once applied: check `select count(*) from public.wagers` on the
-- live project first if you want a copy.
drop function if exists public.create_wager (
  text, text, uuid, numeric, text, uuid, timestamptz, integer, integer, uuid, numeric, text
);

drop table if exists public.wager_stakes;

drop table if exists public.wagers;

drop type if exists public.wager_status;
