import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Wager } from '@/lib/wager';

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
