-- Adds the resolution-related bet statuses (Appendix A.1: active ->
-- pending_result -> disputed (optional) -> resolved; active/pending_result
-- -> tied). Split into its own migration for the same reason as
-- 20260718120000_bet_cancellation_status.sql: Postgres rejects using a
-- freshly added enum value inside the same transaction it was added in, and
-- Supabase applies each migration file as one transaction.
--
-- Deliberately NOT adding 'settled' here, even though Appendix A.1 shows
-- "resolved -> settled": nothing in the PRD's functional requirements
-- (RES-01..07) or §9.3's function list operates on a bet-level "settled"
-- state -- settlement/redemption is described at the ledger/obligation
-- level in §5.5 and is Milestone 11's concern (request_redemption() /
-- confirm_redemption()), not something this bet's own status needs to
-- track. Revisit only if Milestone 11 turns out to need it.
alter type public.bet_status
add value 'pending_result';

alter type public.bet_status
add value 'disputed';

alter type public.bet_status
add value 'resolved';

alter type public.bet_status
add value 'tied';
