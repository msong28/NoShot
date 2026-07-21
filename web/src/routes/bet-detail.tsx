import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { type BadgeVariant, StatusBadge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import {
  useApproveBetVersion,
  useApproveCancelBet,
  useBetDetail,
  useConfirmBetResult,
  useProposeCancelBet,
  useResolveDispute,
  useSubmitBetResult,
  useTriggerRandomFallback,
  useVoteOnDispute,
} from '@/hooks/use-bets';
import { useSession } from '@/hooks/use-session';
import { TIE_OUTCOME_KEY, type BetStatus } from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';

const STATUS_LABELS: Record<BetStatus, string> = {
  draft: 'Draft',
  pending_acceptance: 'Awaiting approval',
  active: 'Active',
  cancellation_pending: 'Cancellation pending',
  voided: 'Voided',
  pending_result: 'Awaiting result',
  disputed: 'Disputed',
  resolved: 'Resolved',
  tied: 'Tied',
};

function statusVariant(status: BetStatus): BadgeVariant {
  switch (status) {
    case 'active':
    case 'resolved':
      return 'success';
    case 'tied':
    case 'voided':
      return 'neutral';
    case 'disputed':
      return 'danger';
    case 'cancellation_pending':
    case 'pending_result':
      return 'warning';
    default:
      return 'info';
  }
}

export function BetDetailScreen() {
  const { betId } = useParams<{ betId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    bet,
    roster,
    cancellationApprovals,
    resultSubmissions,
    resultConfirmations,
    disputeVotes,
    disputeResolution,
    isLoading,
  } = useBetDetail(betId);

  const approveBetVersion = useApproveBetVersion(betId, userId);
  const proposeCancelBet = useProposeCancelBet(betId, userId);
  const approveCancelBet = useApproveCancelBet(betId, userId);
  const submitBetResult = useSubmitBetResult(betId, userId);
  const confirmBetResult = useConfirmBetResult(betId, userId);
  const voteOnDispute = useVoteOnDispute(betId, userId);
  const resolveDispute = useResolveDispute(betId, userId);
  const triggerRandomFallback = useTriggerRandomFallback(betId, userId);

  const [error, setError] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [resultOutcomeKey, setResultOutcomeKey] = useState('');
  const [resultRationale, setResultRationale] = useState('');

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  if (isLoading || !bet) {
    return (
      <main className="mx-auto max-w-app p-four">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="font-display text-sm text-text-secondary"
        >
          ← Back
        </button>
        <p className="mt-four text-text-secondary">Loading…</p>
      </main>
    );
  }

  const myParticipant = roster.find((r) => r.participant.user_id === userId);
  const myApprovalResponded = myParticipant?.approval !== undefined;
  const myCancellationResponse = cancellationApprovals.find((a) => a.user_id === userId);
  const latestResultSubmission = resultSubmissions[resultSubmissions.length - 1];
  const myResultConfirmation = latestResultSubmission
    ? resultConfirmations.find(
        (c) => c.result_submission_id === latestResultSubmission.id && c.user_id === userId,
      )
    : undefined;
  const myDisputeVote = disputeVotes.find((v) => v.voter_id === userId);
  const isJudge = bet.resolution_method === 'judge' && bet.judge_id === userId;

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="font-display text-sm text-text-secondary"
      >
        ← Back
      </button>

      <div className="mt-three flex items-start justify-between gap-two">
        <h1 className="font-display text-2xl font-extrabold">{bet.title}</h1>
        <StatusBadge label={STATUS_LABELS[bet.status]} variant={statusVariant(bet.status)} />
      </div>
      {bet.description ? <p className="mt-two text-text-secondary">{bet.description}</p> : null}
      {bet.deadline ? (
        <p className="mt-two text-sm text-text-faint">
          Deadline: {new Date(bet.deadline).toLocaleString()}
        </p>
      ) : null}

      <SectionHeader title="Participants" />
      <div className="mt-two flex flex-col gap-two">
        {roster.map(({ participant, profile, side, commitment }) => (
          <ListRow
            key={participant.id}
            title={profile?.display_name ?? 'Unknown'}
            subtitle={
              side
                ? `${side.label}${commitment ? ` · staking ${commitment.stake_quantity}` : ''}`
                : undefined
            }
            trailing={
              commitment ? (
                <span className="text-sm text-text-secondary">Wins {commitment.payout_if_win}</span>
              ) : undefined
            }
          />
        ))}
      </div>

      <InlineError message={error} />

      {bet.status === 'pending_acceptance' && !myApprovalResponded ? (
        <>
          <SectionHeader title="This bet needs your approval" />
          <div className="mt-two flex gap-two">
            <button
              type="button"
              onClick={() =>
                run(
                  approveBetVersion.mutateAsync({
                    versionNo: bet.current_version,
                    decision: 'approved',
                  }),
                )
              }
              className="rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() =>
                run(
                  approveBetVersion.mutateAsync({
                    versionNo: bet.current_version,
                    decision: 'declined',
                  }),
                )
              }
              className="rounded-pill bg-surface-sunken px-four py-two font-display font-bold text-text-secondary"
            >
              Decline
            </button>
          </div>
        </>
      ) : null}

      {bet.status === 'active' ? (
        <>
          <SectionHeader title="Actions" />
          <button
            type="button"
            onClick={() => setPendingCancel(true)}
            className="mt-two rounded-pill bg-surface-sunken px-four py-two font-display font-bold text-text-secondary"
          >
            Propose cancellation
          </button>
        </>
      ) : null}

      {bet.status === 'cancellation_pending' && !myCancellationResponse ? (
        <>
          <SectionHeader title="Cancellation requested — your response needed" />
          <div className="mt-two flex gap-two">
            <button
              type="button"
              onClick={() => run(approveCancelBet.mutateAsync('approved'))}
              className="rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary"
            >
              Agree to cancel
            </button>
            <button
              type="button"
              onClick={() => run(approveCancelBet.mutateAsync('declined'))}
              className="rounded-pill bg-surface-sunken px-four py-two font-display font-bold text-text-secondary"
            >
              Keep bet active
            </button>
          </div>
        </>
      ) : null}

      {bet.status === 'pending_result' && !latestResultSubmission ? (
        <>
          <SectionHeader title="Report the result" />
          <div className="mt-two flex flex-col gap-two">
            <select
              value={resultOutcomeKey}
              onChange={(e) => setResultOutcomeKey(e.target.value)}
              className="rounded-medium bg-surface p-three shadow-card"
            >
              <option value="">Pick the outcome…</option>
              {roster.map(({ side }) =>
                side ? (
                  <option key={side.id} value={side.outcome_key}>
                    {side.label}
                  </option>
                ) : null,
              )}
              <option value={TIE_OUTCOME_KEY}>Tie</option>
            </select>
            <textarea
              placeholder="Rationale (optional)"
              value={resultRationale}
              onChange={(e) => setResultRationale(e.target.value)}
              className="rounded-medium bg-surface p-three shadow-card"
            />
            <button
              type="button"
              disabled={!resultOutcomeKey}
              onClick={() =>
                run(
                  submitBetResult.mutateAsync({
                    outcomeKey: resultOutcomeKey,
                    rationale: resultRationale || undefined,
                  }),
                )
              }
              className="self-start rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary disabled:opacity-60"
            >
              Submit result
            </button>
          </div>
        </>
      ) : null}

      {bet.status === 'pending_result' &&
      latestResultSubmission &&
      !myResultConfirmation &&
      latestResultSubmission.submitter_id !== userId ? (
        <>
          <SectionHeader title="Confirm the reported result" />
          <p className="mt-two text-text-secondary">
            Proposed outcome: {latestResultSubmission.proposed_outcome_key}
            {latestResultSubmission.rationale ? ` — ${latestResultSubmission.rationale}` : ''}
          </p>
          <div className="mt-two flex gap-two">
            <button
              type="button"
              onClick={() =>
                run(
                  confirmBetResult.mutateAsync({
                    resultSubmissionId: latestResultSubmission.id,
                    decision: 'approved',
                  }),
                )
              }
              className="rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() =>
                run(
                  confirmBetResult.mutateAsync({
                    resultSubmissionId: latestResultSubmission.id,
                    decision: 'declined',
                  }),
                )
              }
              className="rounded-pill bg-surface-sunken px-four py-two font-display font-bold text-text-secondary"
            >
              Dispute
            </button>
          </div>
        </>
      ) : null}

      {bet.status === 'disputed' ? (
        <>
          <SectionHeader title="Disputed" />
          {disputeResolution ? (
            <p className="mt-two text-text-secondary">
              Resolved as: {disputeResolution.selected_outcome_key}
            </p>
          ) : (
            <div className="mt-two flex flex-col gap-two">
              {isJudge ? (
                <div className="flex flex-wrap gap-two">
                  {roster.map(({ side }) =>
                    side ? (
                      <button
                        key={side.id}
                        type="button"
                        onClick={() => run(resolveDispute.mutateAsync(side.outcome_key))}
                        className="rounded-pill bg-primary px-three py-two font-display text-sm font-bold text-on-primary"
                      >
                        Rule for {side.label}
                      </button>
                    ) : null,
                  )}
                </div>
              ) : bet.resolution_method === 'group_vote' && !myDisputeVote ? (
                <div className="flex flex-wrap gap-two">
                  {roster.map(({ side }) =>
                    side ? (
                      <button
                        key={side.id}
                        type="button"
                        onClick={() => run(voteOnDispute.mutateAsync(side.outcome_key))}
                        className="rounded-pill bg-surface-sunken px-three py-two font-display text-sm font-bold text-text-secondary"
                      >
                        Vote {side.label}
                      </button>
                    ) : null,
                  )}
                </div>
              ) : null}
              {bet.random_fallback_enabled ? (
                <button
                  type="button"
                  onClick={() => run(triggerRandomFallback.mutateAsync())}
                  className="self-start rounded-pill bg-surface-sunken px-four py-two font-display font-bold text-text-secondary"
                >
                  Trigger random fallback
                </button>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      {(bet.status === 'resolved' || bet.status === 'tied') && bet.resolved_outcome_key ? (
        <>
          <SectionHeader title="Result" />
          <p className="mt-two text-text-secondary">
            {bet.status === 'tied' ? 'Tied' : `Won by outcome: ${bet.resolved_outcome_key}`}
          </p>
        </>
      ) : null}

      <ConfirmationDialog
        visible={pendingCancel}
        title="Propose cancelling this bet?"
        description="Every active participant needs to agree before it's actually cancelled."
        confirmLabel="Propose cancellation"
        destructive
        onConfirm={() => {
          run(proposeCancelBet.mutateAsync(undefined));
          setPendingCancel(false);
        }}
        onCancel={() => setPendingCancel(false)}
      />
    </main>
  );
}
