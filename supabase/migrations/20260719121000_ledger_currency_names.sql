-- Second follow-up to 20260719120000_ledger.sql. A bet's currency only has
-- to be visible to its *creator* at commitment time (create_or_counter_bet's
-- own check: builtin, owned by the creator, or scoped to the bet's group) --
-- it doesn't have to be owned by or shared with every participant. So a
-- resulting ledger entry can reference a currency the *other* party can't
-- resolve the name/icon for via currencies' own RLS (which only allows
-- builtins, currencies they own, or currencies scoped to a group they're
-- in). Same fix shape as get_ledger_counterparty_profiles: gate on "I have
-- a ledger_entries row using this currency" instead.
create function public.get_ledger_currency_names (p_ids uuid[]) returns table (id uuid, name text, icon text) language sql stable security definer
set
  search_path = '' as $$
  select c.id, c.name, c.icon
  from public.currencies c
  where c.id = any (p_ids)
    and exists (
      select 1 from public.ledger_entries l
      where l.currency_id = c.id
        and (l.debtor_id = auth.uid() or l.creditor_id = auth.uid())
    );
$$;

revoke execute on function public.get_ledger_currency_names (uuid[])
from
  public;

grant
execute on function public.get_ledger_currency_names (uuid[]) to authenticated;
