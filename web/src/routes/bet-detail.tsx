import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PollCard } from '@/components/poll-card';
import { PollCreateForm } from '@/components/poll-create-form';
import { ReportDialog } from '@/components/report-dialog';
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
import { useComments, usePostComment } from '@/hooks/use-comments';
import { useClosePoll, useCreatePoll, usePolls, useVoteOnPoll } from '@/hooks/use-polls';
import { useProofAssets, useUploadProof } from '@/hooks/use-proof';
import { useSession } from '@/hooks/use-session';
import { TIE_OUTCOME_KEY, type BetStatus } from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';
import type { ReportTargetType } from '@/lib/report';

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
  const { comments } = useComments(betId);
  const postComment = usePostComment(betId);
  const pollScope = useMemo(() => ({ betId }), [betId]);
  const { polls } = usePolls(pollScope);
  const createPoll = useCreatePoll(pollScope);
  const voteOnPoll = useVoteOnPoll(pollScope);
  const closePoll = useClosePoll(pollScope);
  const { assets: proofAssets } = useProofAssets(betId);
  const uploadProof = useUploadProof(betId, userId);

  const [error, setError] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [resultOutcomeKey, setResultOutcomeKey] = useState('');
  const [resultRationale, setResultRationale] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [proofCaption, setProofCaption] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(
    null,
  );

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  function handlePostComment() {
    setError(null);
    postComment.mutate(commentBody, {
      onSuccess: () => setCommentBody(''),
      onError: (err) => setError(getErrorMessage(err, 'Failed to post comment')),
    });
  }

  function handleAddProof() {
    if (!proofFile) return;
    setError(null);
    uploadProof.mutate(
      { file: proofFile, caption: proofCaption.trim() || undefined },
      {
        onSuccess: () => {
          setProofCaption('');
          setProofFile(null);
          if (proofInputRef.current) proofInputRef.current.value = '';
        },
        onError: (err) => setError(getErrorMessage(err, 'Failed to upload proof')),
      },
    );
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
        <div className="flex shrink-0 items-center gap-two">
          <StatusBadge label={STATUS_LABELS[bet.status]} variant={statusVariant(bet.status)} />
          <button
            type="button"
            onClick={() => setReportTarget({ type: 'bet', id: bet.id })}
            className="font-display text-sm text-text-secondary"
          >
            Report
          </button>
        </div>
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

      <SectionHeader title="Proof" />
      <div className="mt-two flex flex-col gap-two">
        {proofAssets.length === 0 ? (
          <p className="text-sm text-text-faint">No proof uploaded yet.</p>
        ) : (
          proofAssets.map(({ asset, signedUrl }) => (
            <div key={asset.id} className="flex flex-col gap-one rounded-large bg-surface p-three shadow-card">
              {signedUrl ? (
                <img
                  src={signedUrl}
                  alt={asset.caption ?? 'Proof'}
                  className="max-h-64 w-full rounded-medium object-cover"
                />
              ) : null}
              {asset.caption ? <p className="text-sm">{asset.caption}</p> : null}
              <div className="flex items-center gap-two">
                {asset.moderation_status === 'pending_review' ? (
                  <StatusBadge label="Pending review" variant="warning" />
                ) : null}
                <button
                  type="button"
                  onClick={() => setReportTarget({ type: 'proof_asset', id: asset.id })}
                  className="font-display text-sm text-text-secondary"
                >
                  Report
                </button>
              </div>
            </div>
          ))
        )}
        {myParticipant ? (
          <div className="flex flex-col gap-two">
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <input
              placeholder="Caption (optional)"
              value={proofCaption}
              onChange={(e) => setProofCaption(e.target.value)}
              className="rounded-medium bg-surface p-three shadow-card"
            />
            <button
              type="button"
              onClick={handleAddProof}
              disabled={!proofFile || uploadProof.isPending}
              className="self-start rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary disabled:opacity-60"
            >
              Add proof photo
            </button>
          </div>
        ) : null}
      </div>

      <SectionHeader title="Polls" />
      <div className="mt-two flex flex-col gap-two">
        {polls.map(({ poll, options, votes }) => (
          <PollCard
            key={poll.id}
            poll={poll}
            options={options}
            votes={votes}
            userId={userId}
            onVote={(optionId) => run(voteOnPoll.mutateAsync({ pollId: poll.id, optionId }))}
            onClose={() => run(closePoll.mutateAsync(poll.id))}
          />
        ))}
        {myParticipant ? (
          <PollCreateForm
            disabled={createPoll.isPending}
            onSubmit={(input) => run(createPoll.mutateAsync(input))}
          />
        ) : null}
      </div>

      <SectionHeader title="Comments" />
      <div className="mt-two flex flex-col gap-two">
        {comments.length === 0 ? (
          <p className="text-sm text-text-faint">No comments yet.</p>
        ) : (
          comments.map(({ comment, author }) => (
            <ListRow
              key={comment.id}
              title={author?.display_name ?? 'Someone'}
              subtitle={comment.body}
              trailing={
                <div className="flex items-center gap-two">
                  {comment.moderation_status === 'pending_review' ? (
                    <StatusBadge label="Pending review" variant="warning" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setReportTarget({ type: 'comment', id: comment.id })}
                    className="font-display text-sm text-text-secondary"
                  >
                    Report
                  </button>
                </div>
              }
            />
          ))
        )}
        {myParticipant ? (
          <div className="flex gap-two">
            <input
              placeholder="Say something"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              className="flex-1 rounded-medium bg-surface p-three shadow-card"
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={!commentBody.trim() || postComment.isPending}
              className="rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary disabled:opacity-60"
            >
              Post
            </button>
          </div>
        ) : null}
      </div>

      <ReportDialog
        visible={reportTarget !== null}
        targetType={reportTarget?.type ?? 'bet'}
        targetId={reportTarget?.id ?? null}
        onClose={() => setReportTarget(null)}
      />
    </main>
  );
}
