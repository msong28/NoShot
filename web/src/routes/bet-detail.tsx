import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Capacitor } from '@capacitor/core';

import { PollCard } from '@/components/poll-card';
import { PollCreateForm } from '@/components/poll-create-form';
import { ReportDialog } from '@/components/report-dialog';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { IconTile } from '@/components/ui/icon-tile';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { ConfirmReveal } from '@/components/ui/confirm-reveal';
import { SettleReveal, type SettleOutcome } from '@/components/ui/settle-reveal';
import {
  useApproveBetVersion,
  useApproveCancelBet,
  useBetDetail,
  useCreateOrCounterBet,
  useEditPendingBetDetails,
  useProposeCancelBet,
  useSubmitBetResult,
  useWithdrawBet,
} from '@/hooks/use-bets';
import { useComments, usePostComment } from '@/hooks/use-comments';
import { useCurrencies } from '@/hooks/use-currencies';
import { useClosePoll, useCreatePoll, usePolls, useVoteOnPoll } from '@/hooks/use-polls';
import { useProofAssets, useUploadProof } from '@/hooks/use-proof';
import { useSession } from '@/hooks/use-session';
import { TIE_OUTCOME_KEY, type Bet, type BetApprovalDecision, type BetStatus } from '@/lib/bet';
import { MONEY_CURRENCY_ID } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';
import { chooseNativeProofPhoto, takeNativeProofPhoto } from '@/lib/native-photo';
import type { Poll, PollOption, PollVote } from '@/lib/poll';
import type { ReportTargetType } from '@/lib/report';

/** Maps every real BetStatus onto the 5-state StatusPill vocabulary, same
 * approach as the Bets tab -- anything not one of the mock's named states
 * gets a neutral pill with its real status word rather than being hidden. */
function pillFor(status: BetStatus): { variant: StatusPillVariant; label?: string } {
  switch (status) {
    case 'pending_acceptance':
      return { variant: 'pending' };
    case 'active':
      return { variant: 'active' };
    case 'cancellation_pending':
      return { variant: 'active', label: 'Cancel pending' };
    case 'pending_result':
      return { variant: 'active', label: 'Awaiting result' };
    case 'disputed':
      return { variant: 'disputed' };
    case 'resolved':
      return { variant: 'won', label: 'Resolved' };
    case 'tied':
      return { variant: 'tied' };
    default:
      return { variant: 'tied', label: status };
  }
}

function daysUntil(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days > 1) return `ends in ${days} days`;
  if (days === 1) return 'ends tomorrow';
  if (days === 0) return 'ends today';
  return 'past deadline';
}

/** Proof photos are user-uploaded and can 404 (expired signed URL, deleted
 * storage object) -- falls back to a labeled placeholder instead of a bare
 * broken-image icon, same resilience pattern as <Brick>. */
function ProofImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-32 w-full flex-col items-center justify-center gap-one rounded-medium border border-dashed border-line bg-surface text-text-faint">
        <Icons.imagePlaceholder size={24} strokeWidth={1.5} />
        <p className="text-xs">Photo unavailable</p>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="max-h-64 w-full rounded-medium object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type ThreadItem =
  | { kind: 'system'; id: string; timestamp: string; text: string }
  | {
      kind: 'comment';
      id: string;
      timestamp: string;
      authorId: string;
      authorName: string;
      body: string;
      moderationPending: boolean;
    }
  | {
      kind: 'proof';
      id: string;
      timestamp: string;
      uploaderId: string;
      caption: string | null;
      signedUrl: string | null;
      moderationPending: boolean;
    }
  | {
      kind: 'poll';
      id: string;
      timestamp: string;
      poll: Poll;
      options: PollOption[];
      votes: PollVote[];
    };

export function BetDetailScreen() {
  const { betId } = useParams<{ betId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const { bet, sides, roster, cancellationApprovals, resultSubmissions, isLoading } =
    useBetDetail(betId);

  const approveBetVersion = useApproveBetVersion(betId, userId);
  const proposeCancelBet = useProposeCancelBet(betId, userId);
  const approveCancelBet = useApproveCancelBet(betId, userId);
  const submitBetResult = useSubmitBetResult(betId, userId);
  const withdrawBet = useWithdrawBet(userId);
  const editBetDetails = useEditPendingBetDetails(betId, userId);
  const createOrCounterBet = useCreateOrCounterBet(userId);
  const { data: currencies } = useCurrencies({ ownerUserId: userId as string });
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
  const [pendingWithdraw, setPendingWithdraw] = useState(false);
  const [pendingDoubleOrNothing, setPendingDoubleOrNothing] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStakeAmount, setEditStakeAmount] = useState('');
  const [editCurrencyKind, setEditCurrencyKind] = useState<'money' | 'custom'>('money');
  const [editCurrencyId, setEditCurrencyId] = useState('');
  const [resultOutcomeKey, setResultOutcomeKey] = useState('');
  const [resultRationale, setResultRationale] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(
    null,
  );
  const [showPollForm, setShowPollForm] = useState(false);
  const [settleOutcome, setSettleOutcome] = useState<SettleOutcome | null>(null);
  const [showAccepted, setShowAccepted] = useState(false);
  const [pendingProofFile, setPendingProofFile] = useState<File | null>(null);
  const [pendingProofPreviewUrl, setPendingProofPreviewUrl] = useState<string | null>(null);
  const [pendingProofCaption, setPendingProofCaption] = useState('');

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

  // Staged, not uploaded immediately -- lets a caption be added, same
  // capability the old separate Proof tab had, restored as a small
  // messaging-app-style attachment preview above the composer instead of a
  // separate tab.
  function handleSelectProofFile(file: File | undefined) {
    if (!file) return;
    setPendingProofFile(file);
    setPendingProofPreviewUrl(URL.createObjectURL(file));
  }

  function cancelPendingProof() {
    if (pendingProofPreviewUrl) URL.revokeObjectURL(pendingProofPreviewUrl);
    setPendingProofFile(null);
    setPendingProofPreviewUrl(null);
    setPendingProofCaption('');
    if (proofInputRef.current) proofInputRef.current.value = '';
  }

  function handleSendProof() {
    if (!pendingProofFile) return;
    setError(null);
    uploadProof.mutate(
      { file: pendingProofFile, caption: pendingProofCaption.trim() || undefined },
      {
        onSuccess: () => cancelPendingProof(),
        onError: (err) => setError(getErrorMessage(err, 'Failed to upload proof')),
      },
    );
  }

  if (isLoading || !bet) {
    return (
      <main className="mx-auto max-w-app p-four">
        <BackButton />
        <p className="mt-four text-text-secondary">Loading…</p>
      </main>
    );
  }

  const myParticipant = roster.find((r) => r.participant.user_id === userId);
  const opponent =
    roster.length === 2 ? roster.find((r) => r.participant.user_id !== userId) : undefined;
  const myApprovalResponded = myParticipant?.approval !== undefined;
  const myCancellationResponse = cancellationApprovals.find((a) => a.user_id === userId);
  const latestResultSubmission = resultSubmissions[resultSubmissions.length - 1];
  const pill = pillFor(bet.status);

  // Fires the settle-reveal overlay for a resolution that happens in *this*
  // page session (the settling action) -- for every outcome, win or lose or
  // tie, so the settler always sees what happened before being sent to Done.
  // Never on a plain page load/revisit, so an old result doesn't replay.
  function runAndReveal(promise: Promise<Bet>) {
    setError(null);
    promise
      .then((updatedBet) => {
        if (updatedBet.status === 'tied') {
          setSettleOutcome('tied');
        } else if (updatedBet.status === 'resolved') {
          const iWon = myParticipant?.side?.outcome_key === updatedBet.resolved_outcome_key;
          setSettleOutcome(iWon ? 'won' : 'lost');
        }
      })
      .catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  // Approving the current version can flip a fully-agreed bet to active. When
  // it does, celebrate it and send them to their Active bets; a decline (or an
  // approval that still leaves others pending) just updates in place.
  function handleApproval(decision: BetApprovalDecision, versionNo: number) {
    setError(null);
    approveBetVersion
      .mutateAsync({ versionNo, decision })
      .then((updatedBet) => {
        if (decision === 'approved' && updatedBet.status === 'active') {
          setShowAccepted(true);
        }
      })
      .catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  // Matches the original "Actions" section's gating exactly -- cancellation
  // is proposed from an active bet; cancellation_pending already has its
  // own agree/keep-active response UI below, not a second cancel trigger.
  const canCancel = bet.status === 'active';

  // Withdrawing (deleting) is only for the creator's own not-yet-agreed
  // proposal -- once the other side has approved, it's active and only
  // mutual cancellation (canCancel above) can undo it.
  const canWithdraw =
    bet.creator_id === userId && (bet.status === 'draft' || bet.status === 'pending_acceptance');

  // Editing (description/stake/currency only -- odds, line, and win-condition
  // wording stay fixed once proposed) is the same "not yet agreed to" window
  // as withdrawing, minus the draft case: a draft is edited by resuming the
  // create flow, not here.
  const canEdit = bet.creator_id === userId && bet.status === 'pending_acceptance';

  function openEditDetails() {
    if (!bet || !myParticipant?.commitment) return;
    setEditTitle(bet.title);
    setEditDescription(bet.description);
    setEditStakeAmount(String(myParticipant.commitment.stake_quantity));
    if (myParticipant.commitment.currency_id === MONEY_CURRENCY_ID) {
      setEditCurrencyKind('money');
      setEditCurrencyId('');
    } else {
      setEditCurrencyKind('custom');
      setEditCurrencyId(myParticipant.commitment.currency_id);
    }
    setError(null);
    setIsEditingDetails(true);
  }

  // Preserves every participant's existing odds ratio and each side's label
  // untouched -- only title/description/currency change, and stake scales
  // proportionally from the creator's new amount so the agreed risk:reward
  // ratio (and BET-05's funding check, which scaling preserves) doesn't move.
  function submitEditDetails() {
    if (!bet) return;
    const newStake = Number.parseFloat(editStakeAmount);
    if (!Number.isFinite(newStake) || newStake <= 0) {
      setError('Enter a valid stake amount');
      return;
    }
    if (editCurrencyKind === 'custom' && !editCurrencyId) {
      setError('Pick a currency');
      return;
    }
    const oldCreatorStake = myParticipant?.commitment?.stake_quantity;
    if (!oldCreatorStake) return;
    const scale = newStake / oldCreatorStake;
    const newCurrencyId = editCurrencyKind === 'money' ? MONEY_CURRENCY_ID : editCurrencyId;

    setError(null);
    editBetDetails.mutate(
      {
        title: editTitle.trim(),
        description: editDescription.trim(),
        deadline: bet.deadline,
        resolutionMethod: bet.resolution_method,
        judgeId: bet.judge_id,
        randomFallbackEnabled: bet.random_fallback_enabled,
        sides: sides.map((s) => ({ outcomeKey: s.outcome_key, label: s.label })),
        participants: roster
          .filter((r) => r.side && r.commitment)
          .map((r) => ({
            userId: r.participant.user_id,
            outcomeKey: r.side!.outcome_key,
            currencyId: newCurrencyId,
            stakeQuantity:
              r.participant.user_id === userId ? newStake : r.commitment!.stake_quantity * scale,
            oddsNumerator: r.commitment!.odds_numerator,
            oddsDenominator: r.commitment!.odds_denominator,
          })),
      },
      {
        onSuccess: () => setIsEditingDetails(false),
        onError: (err) => setError(getErrorMessage(err, 'Could not update the bet')),
      },
    );
  }

  // One-person settlement: whoever reports the outcome on an active
  // participant_submission bet settles it outright (submit_bet_result finalizes
  // immediately). Once a result exists the bet is already resolved, so this
  // only ever shows on a still-active bet.
  const canReportResult = bet.status === 'active' && !latestResultSubmission;

  // Double or nothing: once a bet is settled, either side (winner or loser)
  // can propose running it back at double the stake -- same event, same
  // sides, same odds ratio, just doubled amounts. It's a brand-new bet
  // (create_or_counter_bet with no betId), not an edit of this one, so it
  // goes through the normal pending_acceptance -> approval flow like any
  // other proposal rather than skipping consent.
  const canDoubleOrNothing = bet.status === 'resolved' || bet.status === 'tied';

  function proposeDoubleOrNothing() {
    if (!bet) return;
    setError(null);
    createOrCounterBet.mutate(
      {
        title: bet.title,
        description: bet.description,
        // No deadline carried over -- the original one has already passed
        // (the bet resolved), so reusing it would start the rematch overdue.
        deadline: null,
        resolutionMethod: bet.resolution_method,
        judgeId: bet.judge_id,
        randomFallbackEnabled: bet.random_fallback_enabled,
        sides: sides.map((s) => ({ outcomeKey: s.outcome_key, label: s.label })),
        participants: roster
          .filter((r) => r.side && r.commitment)
          .map((r) => ({
            userId: r.participant.user_id,
            outcomeKey: r.side!.outcome_key,
            currencyId: r.commitment!.currency_id,
            stakeQuantity: r.commitment!.stake_quantity * 2,
            oddsNumerator: r.commitment!.odds_numerator,
            oddsDenominator: r.commitment!.odds_denominator,
          })),
      },
      {
        onSuccess: () => navigate('/bets?tab=pending', { replace: true }),
        onError: (err) => setError(getErrorMessage(err, 'Could not propose a rematch')),
      },
    );
  }

  // README §"Bet thread": chat, photo-proof, and polls are one merged,
  // chronological feed here, not the separate tabs an earlier pass used --
  // each source already carries its own created_at, so no new data is
  // needed to interleave them. bet.activated_at (already on the Bet row)
  // doubles as the "Bet accepted" system-message moment shown in the mock.
  const threadItems: ThreadItem[] = [
    ...(bet.activated_at
      ? ([
          {
            kind: 'system',
            id: 'activated',
            timestamp: bet.activated_at,
            text: `Bet accepted · ${formatShortDate(bet.activated_at)}`,
          },
        ] as const)
      : []),
    ...comments.map(({ comment, author }): ThreadItem => ({
      kind: 'comment',
      id: comment.id,
      timestamp: comment.created_at,
      authorId: comment.author_id,
      authorName: author?.display_name ?? 'Someone',
      body: comment.body,
      moderationPending: comment.moderation_status === 'pending_review',
    })),
    ...proofAssets.map(({ asset, signedUrl }): ThreadItem => ({
      kind: 'proof',
      id: asset.id,
      timestamp: asset.created_at,
      uploaderId: asset.uploader_id,
      caption: asset.caption,
      signedUrl: signedUrl ?? null,
      moderationPending: asset.moderation_status === 'pending_review',
    })),
    ...polls.map(({ poll, options, votes }): ThreadItem => ({
      kind: 'poll',
      id: poll.id,
      timestamp: poll.created_at,
      poll,
      options,
      votes,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <div className="flex items-center justify-between">
        <BackButton />
        <button
          type="button"
          onClick={() => setReportTarget({ type: 'bet', id: bet.id })}
          className="text-sm font-bold text-text-secondary"
        >
          Report
        </button>
      </div>

      <div className="mt-two flex items-center gap-two">
        <StatusPill variant={pill.variant} label={pill.label} />
        {bet.deadline ? (
          <span className="text-sm text-text-secondary">· {daysUntil(bet.deadline)}</span>
        ) : null}
      </div>
      <h1 className="mt-two font-display text-screen-title font-extrabold tracking-display-tight">
        {bet.title}
      </h1>
      {bet.description ? <p className="mt-two text-text-secondary">{bet.description}</p> : null}

      {roster.length === 2 && myParticipant && opponent ? (
        <div className="mt-four flex items-center justify-around rounded-large border border-line bg-surface p-four">
          <div className="flex flex-col items-center gap-two">
            <Avatar id={myParticipant.participant.user_id} name="You" size="lg" />
            <p className="text-sm font-bold">You</p>
          </div>
          <p className="font-display text-lg font-extrabold italic text-text-faint">VS</p>
          <div className="flex flex-col items-center gap-two">
            <Avatar
              id={opponent.participant.user_id}
              name={opponent.profile?.display_name ?? '?'}
              size="lg"
            />
            <p className="text-sm font-bold">{opponent.profile?.display_name ?? 'Unknown'}</p>
          </div>
        </div>
      ) : null}

      {myParticipant?.commitment ? (
        <>
          <p className="mt-four font-mono text-eyebrow tracking-eyebrow font-bold uppercase text-text-faint">
            On the line
          </p>
          <div className="mt-two grid grid-cols-2 gap-two">
            <div className="rounded-large bg-up-soft p-three">
              <p className="text-xs font-bold text-up-ink">IF YOU WIN 🏆</p>
              <p className="mt-one font-display text-lg font-extrabold">
                {myParticipant.commitment.currencies?.icon
                  ? `${myParticipant.commitment.currencies.icon} `
                  : ''}
                {myParticipant.commitment.payout_if_win}{' '}
                {myParticipant.commitment.currencies?.name ?? ''}
              </p>
            </div>
            <div className="rounded-large bg-down-soft p-three">
              <p className="text-xs font-bold text-down-ink">IF YOU LOSE</p>
              <p className="mt-one font-display text-lg font-extrabold">
                {myParticipant.commitment.currencies?.icon
                  ? `${myParticipant.commitment.currencies.icon} `
                  : ''}
                {myParticipant.commitment.stake_quantity}{' '}
                {myParticipant.commitment.currencies?.name ?? ''}
              </p>
            </div>
          </div>
        </>
      ) : null}

      <SectionHeader title="Participants" />
      <div className="mt-two flex flex-col gap-two">
        {roster.map(({ participant, profile, side, commitment }) => (
          <ListRow
            key={participant.id}
            leading={<Avatar id={participant.user_id} name={profile?.display_name ?? '?'} />}
            title={profile?.display_name ?? 'Unknown'}
            subtitle={
              side
                ? `${side.label}${
                    commitment
                      ? ` · staking ${commitment.stake_quantity} ${commitment.currencies?.name ?? ''}`
                      : ''
                  }`
                : undefined
            }
            trailing={
              commitment ? (
                <span className="text-sm text-text-secondary">
                  Wins {commitment.payout_if_win} {commitment.currencies?.name ?? ''}
                </span>
              ) : undefined
            }
          />
        ))}
      </div>

      <InlineError message={error} />

      <div className="mt-four flex flex-col gap-three">
        {threadItems.length === 0 ? (
          <p className="text-sm text-text-faint">
            No activity yet — say something to get it started.
          </p>
        ) : (
          threadItems.map((item) => {
            if (item.kind === 'system') {
              return (
                <p key={item.id} className="text-center text-xs text-text-faint">
                  {item.text}
                </p>
              );
            }

            if (item.kind === 'poll') {
              return (
                <PollCard
                  key={item.id}
                  poll={item.poll}
                  options={item.options}
                  votes={item.votes}
                  userId={userId}
                  onVote={(optionId) =>
                    run(voteOnPoll.mutateAsync({ pollId: item.poll.id, optionId }))
                  }
                  onClose={() => run(closePoll.mutateAsync(item.poll.id))}
                />
              );
            }

            if (item.kind === 'proof') {
              const mine = item.uploaderId === userId;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                >
                  <div className="max-w-[80%] rounded-large border border-line bg-surface-sunken p-two">
                    {item.signedUrl ? (
                      <ProofImage src={item.signedUrl} alt={item.caption ?? 'Proof'} />
                    ) : null}
                    {item.caption ? <p className="mt-one px-one text-sm">{item.caption}</p> : null}
                  </div>
                  <div className="mt-half flex items-center gap-two px-one">
                    {item.moderationPending ? (
                      <StatusBadge label="Pending review" variant="warning" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setReportTarget({ type: 'proof_asset', id: item.id })}
                      className="text-xs text-text-faint"
                    >
                      Report
                    </button>
                  </div>
                </div>
              );
            }

            const mine = item.authorId === userId;
            return (
              <div key={item.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] p-three text-sm ${
                    mine
                      ? 'rounded-large rounded-br-none bg-grape text-on-grape'
                      : 'rounded-large rounded-bl-none border border-line bg-surface'
                  }`}
                >
                  {item.body}
                </div>
                <div className="mt-half flex items-center gap-two px-one">
                  {item.moderationPending ? (
                    <StatusBadge label="Pending review" variant="warning" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setReportTarget({ type: 'comment', id: item.id })}
                    className="text-xs text-text-faint"
                  >
                    Report
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {myParticipant ? (
        <>
          {showPollForm ? (
            <div className="mt-three">
              <PollCreateForm
                disabled={createPoll.isPending}
                onSubmit={(input) => {
                  run(createPoll.mutateAsync(input));
                  setShowPollForm(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPollForm(true)}
              className="mt-three self-start text-sm font-bold text-grape-ink"
            >
              📊 New poll
            </button>
          )}

          <div className="sticky bottom-0 mt-three bg-bg pb-one pt-two">
            {pendingProofFile ? (
              <div className="mb-two flex items-center gap-two rounded-large border border-line bg-surface p-two">
                {pendingProofPreviewUrl ? (
                  <img
                    src={pendingProofPreviewUrl}
                    alt="Selected proof preview"
                    className="h-14 w-14 shrink-0 rounded-medium object-cover"
                  />
                ) : null}
                <input
                  placeholder="Caption (optional)"
                  value={pendingProofCaption}
                  onChange={(e) => setPendingProofCaption(e.target.value)}
                  className="min-w-0 flex-1 rounded-medium border border-line bg-surface-sunken p-two text-sm"
                />
                <button
                  type="button"
                  aria-label="Cancel proof photo"
                  onClick={cancelPendingProof}
                  className="shrink-0 text-text-faint"
                >
                  <Icons.close size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label="Send proof photo"
                  disabled={uploadProof.isPending}
                  onClick={handleSendProof}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-grape text-on-grape disabled:opacity-60"
                >
                  <Icons.send size={16} strokeWidth={2} />
                </button>
              </div>
            ) : null}

            <div className="flex items-center gap-two">
              {Capacitor.isNativePlatform() ? (
                <>
                  <button
                    type="button"
                    aria-label="Take a photo"
                    disabled={uploadProof.isPending}
                    onClick={() => takeNativeProofPhoto().then(handleSelectProofFile)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-line bg-surface text-text-secondary disabled:opacity-60"
                  >
                    <Icons.camera size={20} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label="Choose a photo from your library"
                    disabled={uploadProof.isPending}
                    onClick={() => chooseNativeProofPhoto().then(handleSelectProofFile)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-line bg-surface text-text-secondary disabled:opacity-60"
                  >
                    <Icons.gallery size={20} strokeWidth={2} />
                  </button>
                </>
              ) : (
                <>
                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleSelectProofFile(e.target.files?.[0])}
                    className="hidden"
                  />
                  <button
                    type="button"
                    aria-label="Attach a photo"
                    disabled={uploadProof.isPending}
                    onClick={() => proofInputRef.current?.click()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-line bg-surface text-text-secondary disabled:opacity-60"
                  >
                    <Icons.add size={20} strokeWidth={2} />
                  </button>
                </>
              )}
              <input
                placeholder="Message…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commentBody.trim()) handlePostComment();
                }}
                className="flex-1 rounded-pill border border-line bg-surface p-three"
              />
              <button
                type="button"
                aria-label="Send"
                disabled={!commentBody.trim() || postComment.isPending}
                onClick={handlePostComment}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-grape text-on-grape disabled:opacity-60"
              >
                <Icons.send size={18} strokeWidth={2} />
              </button>
            </div>
          </div>
        </>
      ) : null}

      {bet.status === 'pending_acceptance' && !myApprovalResponded ? (
        <>
          <SectionHeader title="This bet needs your approval" />
          <div className="mt-two flex gap-two">
            <Button
              variant="primary"
              onClick={() => handleApproval('approved', bet.current_version)}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleApproval('declined', bet.current_version)}
            >
              Decline
            </Button>
          </div>
        </>
      ) : null}

      {bet.status === 'cancellation_pending' && !myCancellationResponse ? (
        <>
          <SectionHeader title="Cancellation requested — your response needed" />
          <div className="mt-two flex gap-two">
            <Button
              variant="dangerSolid"
              onClick={() => run(approveCancelBet.mutateAsync('approved'))}
            >
              Agree to cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => run(approveCancelBet.mutateAsync('declined'))}
            >
              Keep bet active
            </Button>
          </div>
        </>
      ) : null}

      {canReportResult ? (
        <>
          <SectionHeader title="Settle bet" />
          <p className="mt-two text-text-secondary">
            Reporting the result settles this bet right away and notifies{' '}
            {opponent?.profile?.display_name ?? 'the other player'}.
          </p>
          <div className="mt-two flex flex-col gap-two">
            <select
              value={resultOutcomeKey}
              onChange={(e) => setResultOutcomeKey(e.target.value)}
              className="rounded-medium border border-line bg-surface p-three"
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
              className="rounded-medium border border-line bg-surface p-three"
            />
            <Button
              variant="primary"
              fullWidth
              disabled={!resultOutcomeKey}
              onClick={() =>
                runAndReveal(
                  submitBetResult.mutateAsync({
                    outcomeKey: resultOutcomeKey,
                    rationale: resultRationale || undefined,
                  }),
                )
              }
            >
              Settle bet
            </Button>
          </div>
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

      {canDoubleOrNothing ? (
        <Button
          variant="primary"
          fullWidth
          className="mt-four"
          onClick={() => setPendingDoubleOrNothing(true)}
        >
          🎲 Double or nothing
        </Button>
      ) : null}

      <ConfirmationDialog
        visible={pendingDoubleOrNothing}
        title="Run it back at double the stakes?"
        description={`Same bet, same terms, twice the stake. ${
          opponent?.profile?.display_name ?? 'The other player'
        } will need to accept before it's on.`}
        confirmLabel="Propose it"
        cancelLabel="Not now"
        onConfirm={() => {
          setPendingDoubleOrNothing(false);
          proposeDoubleOrNothing();
        }}
        onCancel={() => setPendingDoubleOrNothing(false)}
      >
        <ListRow
          leading={
            <IconTile>
              <Icons.bet size={18} strokeWidth={1.75} />
            </IconTile>
          }
          title={bet.title}
          subtitle={
            myParticipant?.commitment
              ? `Your stake: ${myParticipant.commitment.stake_quantity * 2}`
              : undefined
          }
        />
      </ConfirmationDialog>

      {canCancel ? (
        <button
          type="button"
          onClick={() => setPendingCancel(true)}
          className="mt-four block w-full text-center text-sm font-bold text-danger-ink"
        >
          Cancel bet
        </button>
      ) : null}

      {canEdit && !isEditingDetails ? (
        <button
          type="button"
          onClick={openEditDetails}
          className="mt-four block w-full text-center text-sm font-bold text-text-secondary"
        >
          Edit bet
        </button>
      ) : null}

      {canEdit && isEditingDetails ? (
        <div className="mt-four rounded-medium border border-line bg-surface p-three">
          <SectionHeader title="Edit bet" />
          <p className="mt-two mb-one text-xs font-bold text-text-faint">What&rsquo;s the bet?</p>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            maxLength={200}
            className="w-full rounded-medium border border-line bg-surface p-three"
          />
          <p className="mt-two mb-one text-xs font-bold text-text-faint">Details</p>
          <textarea
            placeholder="Add any details (optional)"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            maxLength={2000}
            className="w-full rounded-medium border border-line bg-surface p-three"
          />
          <p className="mt-two mb-one text-xs font-bold text-text-faint">Your stake</p>
          <div className="flex items-center gap-two">
            <input
              value={editStakeAmount}
              onChange={(e) => setEditStakeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              className="w-24 rounded-medium border border-line bg-surface p-three"
            />
            <div className="flex gap-two">
              <button
                type="button"
                onClick={() => setEditCurrencyKind('money')}
                className={`rounded-pill px-three py-two text-sm font-bold ${
                  editCurrencyKind === 'money'
                    ? 'bg-grape text-on-grape'
                    : 'border border-line bg-surface text-text-secondary'
                }`}
              >
                Money
              </button>
              <button
                type="button"
                onClick={() => setEditCurrencyKind('custom')}
                className={`rounded-pill px-three py-two text-sm font-bold ${
                  editCurrencyKind === 'custom'
                    ? 'bg-grape text-on-grape'
                    : 'border border-line bg-surface text-text-secondary'
                }`}
              >
                Custom
              </button>
            </div>
          </div>
          {editCurrencyKind === 'custom' ? (
            <select
              value={editCurrencyId}
              onChange={(e) => setEditCurrencyId(e.target.value)}
              className="mt-two w-full rounded-medium border border-line bg-surface p-three"
            >
              <option value="">Pick a currency…</option>
              {(currencies ?? [])
                .filter((c) => c.moderation_status === 'approved' && c.id !== MONEY_CURRENCY_ID)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          ) : null}
          <div className="mt-three flex gap-two">
            <Button
              variant="primary"
              fullWidth
              disabled={editBetDetails.isPending}
              onClick={submitEditDetails}
            >
              Save changes
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setIsEditingDetails(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {canWithdraw ? (
        <button
          type="button"
          onClick={() => setPendingWithdraw(true)}
          className="mt-four block w-full text-center text-sm font-bold text-danger-ink"
        >
          Delete bet
        </button>
      ) : null}

      <ConfirmationDialog
        visible={pendingCancel}
        title="Propose cancelling this bet?"
        description="Every active participant needs to agree before it's actually cancelled."
        confirmLabel="Propose cancellation"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          run(proposeCancelBet.mutateAsync(undefined));
          setPendingCancel(false);
        }}
        onCancel={() => setPendingCancel(false)}
      >
        <ListRow
          leading={
            <IconTile>
              <Icons.bet size={18} strokeWidth={1.75} />
            </IconTile>
          }
          title={bet.title}
          subtitle={opponent?.profile ? `Active · vs ${opponent.profile.display_name}` : 'Active'}
        />
      </ConfirmationDialog>

      <ConfirmationDialog
        visible={pendingWithdraw}
        title={bet.status === 'draft' ? 'Delete this draft?' : 'Delete this bet?'}
        description={
          bet.status === 'draft'
            ? 'This draft will be gone for good.'
            : `${opponent?.profile?.display_name ?? 'The other player'} hasn't accepted yet, so no one needs to agree -- it'll just disappear.`
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          setPendingWithdraw(false);
          setError(null);
          withdrawBet.mutateAsync(bet.id).then(
            () => navigate('/bets?tab=pending', { replace: true }),
            (err: unknown) => setError(getErrorMessage(err, 'Something went wrong')),
          );
        }}
        onCancel={() => setPendingWithdraw(false)}
      >
        <ListRow
          leading={
            <IconTile>
              <Icons.bet size={18} strokeWidth={1.75} />
            </IconTile>
          }
          title={bet.title}
          subtitle={opponent?.profile ? `Pending · vs ${opponent.profile.display_name}` : 'Pending'}
        />
      </ConfirmationDialog>

      <ReportDialog
        visible={reportTarget !== null}
        targetType={reportTarget?.type ?? 'bet'}
        targetId={reportTarget?.id ?? null}
        onClose={() => setReportTarget(null)}
      />

      {showAccepted ? (
        <ConfirmReveal
          emoji="🤞"
          title="Bet accepted!"
          subtitle="It's on. Good luck."
          onDone={() => navigate('/bets?tab=active', { replace: true })}
        />
      ) : null}

      {settleOutcome ? (
        <SettleReveal
          outcome={settleOutcome}
          betTitle={bet.title}
          opponentName={opponent?.profile?.display_name ?? 'They'}
          amount={
            settleOutcome === 'won'
              ? (myParticipant?.commitment?.payout_if_win ?? 0)
              : (myParticipant?.commitment?.stake_quantity ?? 0)
          }
          currencyName={myParticipant?.commitment?.currencies?.name}
          currencyIcon={myParticipant?.commitment?.currencies?.icon}
          onDone={() => navigate('/bets?tab=done', { replace: true })}
        />
      ) : null}
    </main>
  );
}
