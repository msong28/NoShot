-- Follow-up to 20260719120000_ledger.sql, added as a separate migration
-- rather than editing the already-pushed one (it's live on noshot-dev).
--
-- A balance's counterparty isn't necessarily a friend -- bets don't require
-- friendship (only manual obligations do, per Milestone 10). The existing
-- get_profiles_for_relations() is strictly friendship-gated, so it can't be
-- reused here; this mirrors its exact shape but gates on "I have a
-- ledger_entries row with this person" instead.
create function public.get_ledger_counterparty_profiles (p_ids uuid[]) returns table (id uuid, username text, display_name text) language sql stable security definer
set
  search_path = '' as $$
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.id = any (p_ids)
    and p.deleted_at is null
    and exists (
      select 1 from public.ledger_entries l
      where (l.debtor_id = auth.uid() and l.creditor_id = p.id)
         or (l.creditor_id = auth.uid() and l.debtor_id = p.id)
    );
$$;

revoke execute on function public.get_ledger_counterparty_profiles (uuid[])
from
  public;

grant
execute on function public.get_ledger_counterparty_profiles (uuid[]) to authenticated;
