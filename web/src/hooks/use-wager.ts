import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '@/lib/supabase';
import type { Currency } from '@/lib/currency';
import type { PublicProfile } from '@/lib/friend';
import type { Wager, WagerStake } from '@/lib/wager';

export type CreateWagerInput = {
  event: string;
  description: string;
  rivalId: string;
  stakeAmount: number;
  currencyKind: 'money' | 'custom';
  currencyId: string | null;
  deadline: string | null;
  oddsNumerator: number | null;
  oddsDenominator: number | null;
  oddsFavorsUserId: string | null;
  lineValue: number | null;
  lineCreatorPosition: 'over' | 'under' | null;
};

export function useCreateWager() {
  return useMutation({
    mutationFn: async (input: CreateWagerInput): Promise<Wager> => {
      const { data, error } = await supabase.rpc('create_wager', {
        p_event: input.event,
        p_description: input.description,
        p_rival_id: input.rivalId,
        p_stake_amount: input.stakeAmount,
        p_currency_kind: input.currencyKind,
        p_currency_id: input.currencyId,
        p_deadline: input.deadline,
        p_odds_numerator: input.oddsNumerator,
        p_odds_denominator: input.oddsDenominator,
        p_odds_favors_user_id: input.oddsFavorsUserId,
        p_line_value: input.lineValue,
        p_line_creator_position: input.lineCreatorPosition,
      });
      if (error) throw error;
      return data;
    },
  });
}

export type MyWagerRow = {
  wager: Wager;
  iAmCreator: boolean;
  counterparty: PublicProfile | null;
  myStake: number | null;
  theirStake: number | null;
  currency: Currency | null;
};

/**
 * Every wager the caller is part of (as creator or rival), newest first,
 * enriched with the counterparty's profile, both stake amounts, and the
 * custom-currency row when the stake isn't money. Read-only: the new wagers
 * system is create-only for now, so there's no accept/settle here yet -- this
 * exists so a freshly-sent bet is actually visible instead of vanishing after
 * the "Sent!" screen.
 */
export function useMyWagers(userId: string | undefined) {
  const wagersQuery = useQuery({
    queryKey: ['my-wagers', userId],
    queryFn: async (): Promise<Wager[]> => {
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .or(`creator_id.eq.${userId},rival_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const wagers = useMemo(() => wagersQuery.data ?? [], [wagersQuery.data]);

  const counterpartyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of wagers) ids.add(w.creator_id === userId ? w.rival_id : w.creator_id);
    return Array.from(ids);
  }, [wagers, userId]);

  const profilesQuery = useQuery({
    queryKey: ['profiles-for-relations', [...counterpartyIds].sort()],
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase.rpc('get_profiles_for_relations', {
        p_ids: counterpartyIds,
      });
      if (error) throw error;
      return data;
    },
    enabled: counterpartyIds.length > 0,
  });

  const wagerIds = useMemo(() => wagers.map((w) => w.id), [wagers]);

  const stakesQuery = useQuery({
    queryKey: ['my-wager-stakes', userId, wagerIds],
    queryFn: async (): Promise<WagerStake[]> => {
      const { data, error } = await supabase
        .from('wager_stakes')
        .select('*')
        .in('wager_id', wagerIds);
      if (error) throw error;
      return data;
    },
    enabled: wagerIds.length > 0,
  });

  const currenciesQuery = useQuery({
    queryKey: ['currencies', { ownerUserId: userId }],
    queryFn: async (): Promise<Currency[]> => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .or(`is_builtin.eq.true,owner_user_id.eq.${userId}`);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const rows = useMemo<MyWagerRow[]>(() => {
    const profileById = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
    const currencyById = new Map((currenciesQuery.data ?? []).map((c) => [c.id, c]));
    const stakesByWager = new Map<string, WagerStake[]>();
    for (const s of stakesQuery.data ?? []) {
      const list = stakesByWager.get(s.wager_id) ?? [];
      list.push(s);
      stakesByWager.set(s.wager_id, list);
    }

    return wagers.map((w) => {
      const iAmCreator = w.creator_id === userId;
      const counterpartyId = iAmCreator ? w.rival_id : w.creator_id;
      const stakes = stakesByWager.get(w.id) ?? [];
      return {
        wager: w,
        iAmCreator,
        counterparty: profileById.get(counterpartyId) ?? null,
        myStake: stakes.find((s) => s.user_id === userId)?.amount ?? null,
        theirStake: stakes.find((s) => s.user_id === counterpartyId)?.amount ?? null,
        currency: w.currency_id ? (currencyById.get(w.currency_id) ?? null) : null,
      };
    });
  }, [wagers, userId, profilesQuery.data, currenciesQuery.data, stakesQuery.data]);

  return { wagers: rows, isLoading: wagersQuery.isLoading };
}
