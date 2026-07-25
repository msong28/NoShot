export type WagerStatus = 'pending';

export type CurrencyKind = 'money' | 'custom';

export type Wager = {
  id: string;
  creator_id: string;
  rival_id: string;
  event: string;
  description: string;
  status: WagerStatus;
  created_at: string;
  currency_kind: CurrencyKind;
  currency_label: string | null;
  deadline: string | null;
  odds_numerator: number | null;
  odds_denominator: number | null;
  odds_favors_user_id: string | null;
  line_value: number | null;
  line_creator_position: 'over' | 'under' | null;
};

export type WagerStake = {
  id: string;
  wager_id: string;
  user_id: string;
  amount: number;
};

/**
 * Mirrors create_wager()'s own stake computation exactly, for an instant
 * client-side preview while the form is being edited. Advisory only -- the
 * RPC recomputes and is the actual source of truth, same pattern as
 * lib/bet.ts's computePayoutPreview.
 */
export function computeOddsStakes(
  baseAmount: number,
  oddsNumerator: number,
  oddsDenominator: number,
  creatorIsFavored: boolean,
): { creatorAmount: number; rivalAmount: number } {
  const favoredAmount = baseAmount * oddsNumerator;
  const otherAmount = baseAmount * oddsDenominator;
  return creatorIsFavored
    ? { creatorAmount: favoredAmount, rivalAmount: otherAmount }
    : { creatorAmount: otherAmount, rivalAmount: favoredAmount };
}
