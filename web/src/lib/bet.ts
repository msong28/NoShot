export type BetStatus =
  | 'draft'
  | 'pending_acceptance'
  | 'active'
  | 'cancellation_pending'
  | 'voided'
  | 'pending_result'
  | 'disputed'
  | 'resolved'
  | 'tied';

export type BetVersionStatus = 'draft' | 'proposed' | 'approved';

export type BetResolutionMethod = 'participant_submission' | 'judge' | 'group_vote';

export type BetParticipantRole = 'creator' | 'participant';

export type BetParticipationStatus = 'active' | 'removed';

export type BetApprovalDecision = 'approved' | 'declined';

export type Bet = {
  id: string;
  creator_id: string;
  group_id: string | null;
  title: string;
  description: string;
  current_version: number;
  status: BetStatus;
  deadline: string | null;
  resolution_method: BetResolutionMethod;
  judge_id: string | null;
  random_fallback_enabled: boolean;
  created_at: string;
  activated_at: string | null;
  resolved_at: string | null;
  resolved_outcome_key: string | null;
};

export type BetSide = {
  id: string;
  bet_id: string;
  version_no: number;
  label: string;
  outcome_key: string;
};

export type BetParticipant = {
  id: string;
  bet_id: string;
  user_id: string;
  side_id: string;
  role: BetParticipantRole;
  participation_status: BetParticipationStatus;
  created_at: string;
};

export type BetCommitment = {
  id: string;
  bet_id: string;
  version_no: number;
  participant_id: string;
  currency_id: string;
  stake_quantity: number;
  odds_numerator: number;
  odds_denominator: number;
  payout_if_win: number;
  created_at: string;
};

export type BetApproval = {
  id: string;
  bet_id: string;
  version_no: number;
  user_id: string;
  decision: BetApprovalDecision;
  created_at: string;
};

export type BetCancellationApproval = {
  id: string;
  bet_id: string;
  user_id: string;
  decision: BetApprovalDecision;
  reason: string | null;
  created_at: string;
};

export type BetResultSubmission = {
  id: string;
  bet_id: string;
  submitter_id: string;
  proposed_outcome_key: string;
  rationale: string | null;
  created_at: string;
};

export type BetResultConfirmation = {
  id: string;
  bet_id: string;
  result_submission_id: string;
  user_id: string;
  decision: BetApprovalDecision;
  created_at: string;
};

export type BetDisputeVote = {
  id: string;
  bet_id: string;
  voter_id: string;
  outcome_key: string;
  created_at: string;
};

export type DisputeResolution = {
  id: string;
  bet_id: string;
  eligible_outcomes_json: string[] | null;
  resolution_method: BetResolutionMethod;
  judge_or_vote_snapshot_json: Record<string, unknown> | null;
  selected_outcome_key: string;
  created_at: string;
};

/** Reserved outcome key always valid for a result, independent of whatever
 * sides exist on the bet -- see the resolution migration's own comment. */
export const TIE_OUTCOME_KEY = 'tie';

export const ResolutionMethods: { value: BetResolutionMethod; label: string }[] = [
  { value: 'participant_submission', label: 'Either of us reports the result' },
  { value: 'judge', label: 'A judge decides' },
  { value: 'group_vote', label: 'The group votes' },
];

/** What one side of a proposed bet looks like before it has an id. */
export type BetSideDraft = {
  outcomeKey: string;
  label: string;
};

/** One participant's commitment on a specific side, before submission. */
export type BetParticipantDraft = {
  userId: string;
  outcomeKey: string;
  currencyId: string;
  stakeQuantity: number;
  oddsNumerator: number;
  oddsDenominator: number;
};

/**
 * Mirrors bet_commitments.payout_if_win in the migration exactly: risking
 * oddsNumerator to win oddsDenominator, scaled by the actual stake.
 */
export function computePayoutIfWin(
  stakeQuantity: number,
  oddsNumerator: number,
  oddsDenominator: number,
): number {
  if (oddsNumerator <= 0) return 0;
  return (stakeQuantity * oddsDenominator) / oddsNumerator;
}

export type PayoutPreviewRow = {
  outcomeKey: string;
  outcomeLabel: string;
  userId: string;
  amount: number;
};

/**
 * Client-side mirror of get_bet_payout_preview() / the funding check inside
 * create_or_counter_bet() -- for instant feedback while the creation wizard
 * is still being edited. Advisory only; the server re-validates on submit,
 * same pattern as the moderation filter.
 */
export function computePayoutPreview(
  sides: BetSideDraft[],
  participants: BetParticipantDraft[],
): PayoutPreviewRow[] {
  const sideLabelByKey = new Map(sides.map((s) => [s.outcomeKey, s.label]));
  const rows: PayoutPreviewRow[] = [];

  for (const outcome of sides) {
    for (const participant of participants) {
      const isWinner = participant.outcomeKey === outcome.outcomeKey;
      const amount = isWinner
        ? computePayoutIfWin(
            participant.stakeQuantity,
            participant.oddsNumerator,
            participant.oddsDenominator,
          )
        : -participant.stakeQuantity;

      rows.push({
        outcomeKey: outcome.outcomeKey,
        outcomeLabel: sideLabelByKey.get(outcome.outcomeKey) ?? outcome.label,
        userId: participant.userId,
        amount,
      });
    }
  }

  return rows;
}

export type FundingCheck = {
  outcomeKey: string;
  outcomeLabel: string;
  winnerPayout: number;
  loserPool: number;
  isFunded: boolean;
};

/** Client-side mirror of the BET-05 funding validation. */
export function computeFundingChecks(
  sides: BetSideDraft[],
  participants: BetParticipantDraft[],
): FundingCheck[] {
  return sides.map((outcome) => {
    let winnerPayout = 0;
    let loserPool = 0;

    for (const participant of participants) {
      if (participant.outcomeKey === outcome.outcomeKey) {
        winnerPayout += computePayoutIfWin(
          participant.stakeQuantity,
          participant.oddsNumerator,
          participant.oddsDenominator,
        );
      } else {
        loserPool += participant.stakeQuantity;
      }
    }

    return {
      outcomeKey: outcome.outcomeKey,
      outcomeLabel: outcome.label,
      winnerPayout,
      loserPool,
      isFunded: winnerPayout <= loserPool,
    };
  });
}
