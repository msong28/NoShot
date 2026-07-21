import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '@/lib/supabase';
import type {
  Allocation,
  ForgivenessEvent,
  OutstandingObligation,
  RedemptionRequest,
} from '@/lib/redemption';
import type { PublicProfile } from '@/lib/friend';

function outstandingQueryKey(
  userId: string | undefined,
  counterpartyId: string | undefined,
  currencyId: string | undefined,
  groupId: string | null | undefined,
) {
  return ['outstanding-obligations', userId, counterpartyId, currencyId, groupId] as const;
}

/** The redeem/forgive selection list for one counterparty/currency/group. */
export function useOutstandingObligations(
  userId: string | undefined,
  counterpartyId: string | undefined,
  currencyId: string | undefined,
  groupId: string | null | undefined,
) {
  return useQuery({
    queryKey: outstandingQueryKey(userId, counterpartyId, currencyId, groupId),
    queryFn: async (): Promise<OutstandingObligation[]> => {
      const { data, error } = await supabase.rpc('get_outstanding_obligations', {
        p_counterparty_id: counterpartyId,
        p_currency_id: currencyId,
        p_group_id: groupId ?? null,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!counterpartyId && !!currencyId,
  });
}

function redemptionsQueryKey(userId: string | undefined) {
  return ['redemption-requests', userId] as const;
}

/** Pending redemption requests split into what needs the caller's response
 * (they're the creditor being asked to confirm) vs. what's waiting on the
 * other party, plus resolved history -- same shape as useManualObligations. */
export function useMyRedemptions(userId: string | undefined) {
  const requestsQuery = useQuery({
    queryKey: redemptionsQueryKey(userId),
    queryFn: async (): Promise<RedemptionRequest[]> => {
      const { data, error } = await supabase
        .from('redemption_requests')
        .select('*')
        .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);

  const counterpartyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of requests) {
      ids.add(r.debtor_id === userId ? r.creditor_id : r.debtor_id);
    }
    return Array.from(ids);
  }, [requests, userId]);

  const profilesQuery = useQuery({
    queryKey: ['ledger-counterparty-profiles', counterpartyIds],
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase.rpc('get_ledger_counterparty_profiles', {
        p_ids: counterpartyIds,
      });
      if (error) throw error;
      return data;
    },
    enabled: counterpartyIds.length > 0,
  });

  const profilesById = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const profile of profilesQuery.data ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [profilesQuery.data]);

  function toRow(r: RedemptionRequest) {
    const counterpartyId = r.debtor_id === userId ? r.creditor_id : r.debtor_id;
    return {
      request: r,
      counterparty: profilesById.get(counterpartyId),
      iAmDebtor: r.debtor_id === userId,
    };
  }

  const needsMyConfirmation = requests
    .filter((r) => r.status === 'pending' && r.creditor_id === userId)
    .map(toRow);

  const waitingOnThem = requests
    .filter((r) => r.status === 'pending' && r.debtor_id === userId)
    .map(toRow);

  const resolved = requests.filter((r) => r.status !== 'pending').map(toRow);

  return {
    needsMyConfirmation,
    waitingOnThem,
    resolved,
    isLoading: requestsQuery.isLoading || profilesQuery.isLoading,
  };
}

function invalidateSettlementQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
) {
  queryClient.invalidateQueries({ queryKey: ['my-balances'] });
  queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
  queryClient.invalidateQueries({ queryKey: ['outstanding-obligations'] });
  queryClient.invalidateQueries({ queryKey: redemptionsQueryKey(userId) });
}

export function useRequestRedemption(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allocations: Allocation[]) => {
      const { data, error } = await supabase.rpc('request_redemption', {
        p_allocations: allocations,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSettlementQueries(queryClient, userId),
  });
}

export function useConfirmRedemption(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('confirm_redemption', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSettlementQueries(queryClient, userId),
  });
}

export function useDeclineRedemption(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('decline_redemption', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSettlementQueries(queryClient, userId),
  });
}

export function useCancelRedemption(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('cancel_redemption', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSettlementQueries(queryClient, userId),
  });
}

export function useForgiveObligation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      allocations: Allocation[];
      note?: string;
    }): Promise<ForgivenessEvent> => {
      const { data, error } = await supabase.rpc('forgive_obligation', {
        p_allocations: input.allocations,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSettlementQueries(queryClient, userId),
  });
}
