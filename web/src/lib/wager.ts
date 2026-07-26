import type { CreateOrCounterBetInput } from '@/hooks/use-bets';
import type { BetParticipantDraft, BetSideDraft } from '@/lib/bet';

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
  currency_id: string | null;
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

/** The create screen's own state, flattened, ready to map onto the shared bet
 * engine. `currencyId` is already resolved (the built-in Money id for a money
 * stake, or the picked custom currency). */
export type WagerFormInput = {
  creatorId: string;
  rivalId: string;
  rivalName: string;
  event: string;
  description: string;
  currencyId: string;
  stakeAmount: number;
  deadline: string | null;
  odds: { numerator: number; denominator: number; favorsCreator: boolean } | null;
  line: { value: number; position: 'over' | 'under' } | null;
  /** Optional custom outcome labels: what each side is wagering will happen
   * (e.g. "Maya comes late" vs "Maya does not"). `creatorLabel` is the side the
   * creator is taking. Mutually exclusive with `line` (both name the sides);
   * when both are somehow present, `line` wins. */
  winConditions: { creatorLabel: string; rivalLabel: string } | null;
};

/**
 * Maps the from-scratch create screen onto create_or_counter_bet's payload --
 * the convergence at the heart of "Path B" (one bet engine, not two).
 *
 * Sides: a line becomes over/under outcomes; otherwise a plain you-vs-rival
 * pair. Odds: the new screen's "risk:reward for the favored side, base stake is
 * the 1 unit" is re-expressed as the old engine's per-participant
 * stake_quantity + odds, chosen so payout_if_win (stake x denom/num) equals what
 * that side actually wins -- which is exactly the other side's stake, so BET-05
 * funding (winner payout <= loser pool) holds with equality. Even (no-odds)
 * bets are symmetric stakes at 1:1.
 */
export function buildBetInput(input: WagerFormInput): CreateOrCounterBetInput {
  const creatorKey = input.line ? input.line.position : 'creator';
  const rivalKey = input.line
    ? input.line.position === 'over'
      ? 'under'
      : 'over'
    : 'rival';

  let sides: BetSideDraft[];
  if (input.line) {
    sides = [
      { outcomeKey: 'over', label: `Over ${input.line.value}` },
      { outcomeKey: 'under', label: `Under ${input.line.value}` },
    ];
  } else if (input.winConditions) {
    // Same creator/rival keys as the generic case, only the labels change.
    sides = [
      { outcomeKey: 'creator', label: input.winConditions.creatorLabel },
      { outcomeKey: 'rival', label: input.winConditions.rivalLabel },
    ];
  } else {
    sides = [
      { outcomeKey: 'creator', label: 'You' },
      { outcomeKey: 'rival', label: input.rivalName },
    ];
  }

  let creatorStake = input.stakeAmount;
  let creatorNum = 1;
  let creatorDenom = 1;
  let rivalStake = input.stakeAmount;
  let rivalNum = 1;
  let rivalDenom = 1;

  if (input.odds) {
    const { numerator: n, denominator: d, favorsCreator } = input.odds;
    if (favorsCreator) {
      creatorStake = input.stakeAmount * n;
      creatorNum = n;
      creatorDenom = d;
      rivalStake = input.stakeAmount * d;
      rivalNum = d;
      rivalDenom = n;
    } else {
      creatorStake = input.stakeAmount * d;
      creatorNum = d;
      creatorDenom = n;
      rivalStake = input.stakeAmount * n;
      rivalNum = n;
      rivalDenom = d;
    }
  }

  const participants: BetParticipantDraft[] = [
    {
      userId: input.creatorId,
      outcomeKey: creatorKey,
      currencyId: input.currencyId,
      stakeQuantity: creatorStake,
      oddsNumerator: creatorNum,
      oddsDenominator: creatorDenom,
    },
    {
      userId: input.rivalId,
      outcomeKey: rivalKey,
      currencyId: input.currencyId,
      stakeQuantity: rivalStake,
      oddsNumerator: rivalNum,
      oddsDenominator: rivalDenom,
    },
  ];

  return {
    groupId: null,
    title: input.event,
    description: input.description,
    deadline: input.deadline,
    resolutionMethod: 'participant_submission',
    judgeId: null,
    randomFallbackEnabled: false,
    sides,
    participants,
    isDraft: false,
  };
}
