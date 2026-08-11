import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Balance, LedgerEntry } from '@/lib/ledger';
import { supabase } from '@/lib/supabase';

/** Every consolidated balance the caller is a party to (BAL-01), plus the
 * profile/currency lookups needed to render them -- both use dedicated
 * ledger-relationship-gated helpers since a counterparty or currency isn't
 * always visible via friendship/ownership RLS alone (a bet doesn't require
 * friendship, and a currency only has to be visible to its creator). */
export function useMyBalances(userId: string | undefined) {
  const balancesQuery = useQuery({
    queryKey: ['my-balances', userId],
    queryFn: async (): Promise<Balance[]> => {
      const { data, error } = await supabase.rpc('get_my_balances');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const balances = useMemo(() => balancesQuery.data ?? [], [balancesQuery.data]);
  const counterpartyIds = useMemo(
    () => [...new Set(balances.map((b) => b.counterparty_id))],
    [balances],
  );
  const currencyIds = useMemo(() => [...new Set(balances.map((b) => b.currency_id))], [balances]);

  const profilesQuery = useQuery({
    queryKey: ['ledger-counterparty-profiles', counterpartyIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ledger_counterparty_profiles', {
        p_ids: counterpartyIds,
      });
      if (error) throw error;
      return data as { id: string; username: string; display_name: string }[];
    },
    enabled: counterpartyIds.length > 0,
  });

  const currenciesQuery = useQuery({
    queryKey: ['ledger-currency-names', currencyIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ledger_currency_names', {
        p_ids: currencyIds,
      });
      if (error) throw error;
      return data as { id: string; name: string; icon: string | null }[];
    },
    enabled: currencyIds.length > 0,
  });

  const rows = useMemo(() => {
    const profilesById = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
    const currenciesById = new Map((currenciesQuery.data ?? []).map((c) => [c.id, c]));
    return balances.map((balance) => ({
      balance,
      counterparty: profilesById.get(balance.counterparty_id),
      currency: currenciesById.get(balance.currency_id),
    }));
  }, [balances, profilesQuery.data, currenciesQuery.data]);

  return {
    rows,
    isLoading: balancesQuery.isLoading || profilesQuery.isLoading || currenciesQuery.isLoading,
  };
}

/** The underlying ledger entries behind one consolidated balance (BAL-02). */
export function useLedgerEntriesBetween(
  userId: string | undefined,
  counterpartyId: string | undefined,
  currencyId: string | undefined,
  groupId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['ledger-entries', userId, counterpartyId, currencyId, groupId],
    queryFn: async (): Promise<LedgerEntry[]> => {
      let query = supabase
        .from('ledger_entries')
        .select('*')
        .or(
          `and(debtor_id.eq.${userId},creditor_id.eq.${counterpartyId}),and(debtor_id.eq.${counterpartyId},creditor_id.eq.${userId})`,
        )
        .eq('currency_id', currencyId as string)
        .order('created_at', { ascending: false });
      query = groupId ? query.eq('group_id', groupId) : query.is('group_id', null);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!counterpartyId && !!currencyId,
  });
}
