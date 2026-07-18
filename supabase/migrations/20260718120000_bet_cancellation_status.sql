-- Adds the 'cancellation_pending' bet status (Appendix A.1: draft/
-- pending_acceptance/active -> cancellation_pending -> voided). Split into
-- its own migration, separate from the table/functions that actually use
-- this value (20260718120500_bet_cancellation.sql) -- Postgres rejects
-- using a freshly added enum value inside the same transaction it was
-- added in, and Supabase applies each migration file as one transaction.
alter type public.bet_status
add value 'cancellation_pending';
