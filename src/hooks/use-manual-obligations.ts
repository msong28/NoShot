import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '@/lib/supabase';
import type { ManualObligationProposal } from '@/lib/manual-obligation';
import type { Currency } from '@/lib/currency';
import type { PublicProfile } from '@/lib/friend';

function proposalsQueryKey(userId: string | undefined) {
  return ['manual-obligation-proposals', userId] as const;
}

function relatedProfilesQueryKey(ids: string[]) {
  return ['profiles-for-relations', [...ids].sort()] as const;
}

function personalCurrenciesQueryKey(userId: string | undefined) {
  return ['currencies', { ownerUserId: userId }] as const;
}

function useProposalsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: proposalsQueryKey(userId),
    queryFn: async (): Promise<ManualObligationProposal[]> => {
      const { data, error } = await supabase
        .from('manual_obligation_proposals')
        .select('*')
        .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

function useRelatedProfiles(ids: string[]) {
  return useQuery({
    queryKey: relatedProfilesQueryKey(ids),
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase.rpc('get_profiles_for_relations', { p_ids: ids });
      if (error) throw error;
      return data;
    },
    enabled: ids.length > 0,
  });
}

/** Builtins plus the caller's own personal currencies -- the only ones a
 * manual-obligation currency picker can offer, since a group currency
 * would need a shared group to already be established between the two
 * friends, which this flow doesn't assume. */
function usePersonalCurrencies(userId: string | undefined) {
  return useQuery({
    queryKey: personalCurrenciesQueryKey(userId),
    queryFn: async (): Promise<Currency[]> => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .or(`is_builtin.eq.true,owner_user_id.eq.${userId}`)
        .order('is_builtin', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

/**
 * Combines raw proposal rows with resolved counterparty profiles into the
 * lists the Obligations screen needs: incoming (awaiting my response) and
 * outgoing (awaiting theirs), plus resolved history.
 */
export function useManualObligations(userId: string | undefined) {
  const proposalsQuery = useProposalsQuery(userId);
  const proposals = useMemo(() => proposalsQuery.data ?? [], [proposalsQuery.data]);

  const counterpartyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of proposals) {
      ids.add(p.debtor_id === userId ? p.creditor_id : p.debtor_id);
    }
    return Array.from(ids);
  }, [proposals, userId]);

  const profilesQuery = useRelatedProfiles(counterpartyIds);
  const profilesById = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const profile of profilesQuery.data ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [profilesQuery.data]);

  const currenciesQuery = usePersonalCurrencies(userId);
  const currenciesById = useMemo(() => {
    const map = new Map<string, Currency>();
    for (const currency of currenciesQuery.data ?? []) {
      map.set(currency.id, currency);
    }
    return map;
  }, [currenciesQuery.data]);

  function toRow(p: ManualObligationProposal) {
    const counterpartyId = p.debtor_id === userId ? p.creditor_id : p.debtor_id;
    const iAmDebtor = p.debtor_id === userId;
    return {
      proposal: p,
      counterparty: profilesById.get(counterpartyId),
      currency: currenciesById.get(p.currency_id),
      iAmDebtor,
      iAmProposer: p.proposer_id === userId,
    };
  }

  const incoming = proposals
    .filter((p) => p.status === 'pending' && p.proposer_id !== userId)
    .map(toRow)
    .filter((row) => !!row.counterparty);

  const outgoing = proposals
    .filter((p) => p.status === 'pending' && p.proposer_id === userId)
    .map(toRow)
    .filter((row) => !!row.counterparty);

  const resolved = proposals
    .filter((p) => p.status !== 'pending')
    .map(toRow)
    .filter((row) => !!row.counterparty);

  return {
    incoming,
    outgoing,
    resolved,
    currencies: currenciesQuery.data ?? [],
    isLoading: proposalsQuery.isLoading || profilesQuery.isLoading || currenciesQuery.isLoading,
  };
}

function useInvalidateProposals(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: proposalsQueryKey(userId) });
}

export function useProposeManualObligation(userId: string | undefined) {
  const invalidate = useInvalidateProposals(userId);
  return useMutation({
    mutationFn: async (input: {
      debtorId: string;
      creditorId: string;
      currencyId: string;
      amount: number;
      description: string;
    }) => {
      const { data, error } = await supabase.rpc('propose_manual_obligation', {
        p_debtor_id: input.debtorId,
        p_creditor_id: input.creditorId,
        p_currency_id: input.currencyId,
        p_amount: input.amount,
        p_description: input.description,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useApproveManualObligation(userId: string | undefined) {
  const invalidate = useInvalidateProposals(userId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('approve_manual_obligation', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDeclineManualObligation(userId: string | undefined) {
  const invalidate = useInvalidateProposals(userId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('decline_manual_obligation', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useCancelManualObligation(userId: string | undefined) {
  const invalidate = useInvalidateProposals(userId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('cancel_manual_obligation', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
