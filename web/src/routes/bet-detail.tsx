import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ActionSheet } from '@/components/ui/action-sheet';
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
import {
  useApproveBetVersion,
  useApproveCancelBet,
  useBetDetail,
  useCallOffBet,
  useConfirmBetResult,
  useCreateOrCounterBet,
  useEditPendingBetDetails,
  useProposeBetAmendment,
  useProposeCancelBet,
  useRespondToBetAmendment,
  useWithdrawBet,
  useWithdrawBetAmendment,
} from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useProofAssets } from '@/hooks/use-proof';
import { useSession } from '@/hooks/use-session';
import { TIE_OUTCOME_KEY, voidedLabel, type Bet, type BetApprovalDecision } from '@/lib/bet';
import { MONEY_CURRENCY_ID } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';
import type { ReportTargetType } from '@/lib/report';

/** Maps every real BetStatus onto the 5-state StatusPill vocabulary, same
 * approach as the Bets tab -- anything not one of the mock's named states
 * gets a neutral pill with its real status word rather than being hidden. */
function pillFor(bet: Bet): { variant: StatusPillVariant; label?: string } {
  switch (bet.status) {
    case 'pending_acceptance':
      return { variant: 'pending' };
    case 'active':
      return { variant: 'active' };
    case 'cancellation_pending':
      return { variant: 'active', label: 'Cancel pending' };
    case 'pending_result':
      return { variant: 'active', label: 'Result reported' };
    case 'voided':
      return { variant: 'tied', label: voidedLabel(bet) };
    case 'disputed':
      return { variant: 'disputed' };
    case 'resolved':
      return { variant: 'won', label: 'Resolved' };
    case 'tied':
      return { variant: 'tied' };
    default:
      return { variant: 'tied', label: bet.status };
  }
}

/** "in 2 days" / "in 5 hours" for the result lock-in countdown. */
function timeUntil(iso: string): string {
  const hours = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3600000));
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return `in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return 'soon';
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
      kind: 'proof';
      id: string;
      timestamp: string;
      uploaderId: string;
      caption: string | null;
      signedUrl: string | null;
      moderationPending: boolean;
    };

export function BetDetailScreen() {
  const { betId } = useParams<{ betId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    bet,
    sides,
    roster,
    cancellationApprovals,
    resultSubmissions,
    pendingAmendment,
    isLoading,
  } = useBetDetail(betId);

  const approveBetVersion = useApproveBetVersion(betId, userId);
  const proposeCancelBet = useProposeCancelBet(betId, userId);
  const approveCancelBet = useApproveCancelBet(betId, userId);
  const withdrawBet = useWithdrawBet(userId);
  const editBetDetails = useEditPendingBetDetails(betId, userId);
  const proposeAmendment = useProposeBetAmendment(betId, userId);
  const respondToAmendment = useRespondToBetAmendment(betId, userId);
  const withdrawAmendment = useWithdrawBetAmendment(betId, userId);
  const confirmResult = useConfirmBetResult(betId, userId);
  const callOffBet = useCallOffBet(betId, userId);
  const createOrCounterBet = useCreateOrCounterBet(userId);
  const { data: currencies } = useCurrencies({ ownerUserId: userId as string });
  const { assets: proofAssets } = useProofAssets(betId);

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
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [pendingDispute, setPendingDispute] = useState(false);
  const [pendingCallOff, setPendingCallOff] = useState(false);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
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
  // Sides worth showing only when they carry real information (an over/under
  // line or custom win conditions) -- the default "You"/"{name}" labels just
  // repeat what the header already says.
  const rosterNames = new Set(roster.map((r) => r.profile?.display_name).filter(Boolean));
  const isGenericLabel = (label: string | undefined) =>
    !label || label === 'You' || label === 'Them' || rosterNames.has(label);
  const genericSides =
    isGenericLabel(myParticipant?.side?.label) && isGenericLabel(opponent?.side?.label);
  const myApprovalResponded = myParticipant?.approval !== undefined;
  const myCancellationResponse = cancellationApprovals.find((a) => a.user_id === userId);
  const pendingReport =
    resultSubmissions.find((s) => s.id === bet.result_submission_id) ??
    resultSubmissions[resultSubmissions.length - 1];
  const pill = pillFor(bet);
  const opponentName = opponent?.profile?.display_name ?? 'The other player';
  const deadlinePassed =
    bet.status === 'active' && !!bet.deadline && new Date(bet.deadline).getTime() < Date.now();

  /** "Alice won" / "Over 2.5 won" / "It was a tie", from an outcome key. */
  function outcomeText(outcomeKey: string | null | undefined): string {
    if (!outcomeKey) return '';
    if (outcomeKey === TIE_OUTCOME_KEY) return 'It was a tie';
    if (myParticipant?.side?.outcome_key === outcomeKey) {
      return isGenericLabel(myParticipant.side.label)
        ? 'You won'
        : `${myParticipant.side.label} won (you)`;
    }
    const winner = roster.find((r) => r.side?.outcome_key === outcomeKey);
    if (!winner) return outcomeKey;
    const name = winner.profile?.display_name ?? 'They';
    return isGenericLabel(winner.side?.label)
      ? `${name} won`
      : `${winner.side!.label} won (${name})`;
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

  // Changing terms (title/description/stake/currency -- odds, line, and
  // win-condition wording stay fixed) never happens without the other side:
  // - creator, before acceptance: edit your own proposal (they re-approve)
  // - recipient, before acceptance: counter with different terms (creator
  //   then accepts or declines)
  // - either side, once active: propose a change; the bet stays as agreed
  //   until the other person accepts it (respond_to_bet_amendment)
  const editMode: 'edit' | 'counter' | 'amend' | null = !myParticipant
    ? null
    : bet.status === 'pending_acceptance'
      ? bet.creator_id === userId
        ? 'edit'
        : 'counter'
      : bet.status === 'active' && !pendingAmendment && roster.length === 2
        ? 'amend'
        : null;
  const canEdit = editMode !== null;
  const editCopy = {
    edit: { menu: 'Edit bet', header: 'Edit bet', submit: 'Save changes' },
    counter: {
      menu: 'Suggest different terms',
      header: 'Suggest different terms',
      submit: 'Send to ' + opponentName,
    },
    amend: {
      menu: 'Propose a change',
      header: 'Propose a change',
      submit: 'Send to ' + opponentName,
    },
  } as const;

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
    const mutation = editMode === 'amend' ? proposeAmendment : editBetDetails;
    mutation.mutate(
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
        onError: (err: unknown) => setError(getErrorMessage(err, 'Could not update the bet')),
      },
    );
  }

  // "Who won?" (report-then-confirm, 20261113090000_bet_lifecycle.sql): either
  // side reports from an active bet. Reporting your own loss is final at once;
  // claiming a win or a tie waits for the other side to confirm or dispute,
  // and locks in by itself if they don't answer in time.
  const canReportResult = bet.status === 'active' && !!myParticipant;
  const awaitingMyConfirmation =
    bet.status === 'pending_result' &&
    !!myParticipant &&
    bet.result_reported_by !== userId &&
    bet.resolution_method === 'participant_submission';
  const reporterName =
    roster.find((r) => r.participant.user_id === bet.result_reported_by)?.profile?.display_name ??
    'Someone';

  function claimText(outcomeKey: string | undefined, byMe: boolean): string {
    if (!outcomeKey) return '';
    if (outcomeKey === TIE_OUTCOME_KEY)
      return byMe ? 'You said it was a tie' : `${reporterName} says it was a tie`;
    const reporterSide = roster.find(
      (r) => r.participant.user_id === bet!.result_reported_by,
    )?.side;
    if (reporterSide?.outcome_key === outcomeKey)
      return byMe ? 'You said you won' : `${reporterName} says they won`;
    return byMe
      ? `You said: ${outcomeText(outcomeKey)}`
      : `${reporterName} says: ${outcomeText(outcomeKey)}`;
  }

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
    ...proofAssets.map(({ asset, signedUrl }): ThreadItem => ({
      kind: 'proof',
      id: asset.id,
      timestamp: asset.created_at,
      uploaderId: asset.uploader_id,
      caption: asset.caption,
      signedUrl: signedUrl ?? null,
      moderationPending: asset.moderation_status === 'pending_review',
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const amendmentChanges: string[] = [];
  if (pendingAmendment) {
    if (pendingAmendment.title !== bet.title) {
      amendmentChanges.push(`Bet: “${bet.title}” → “${pendingAmendment.title}”`);
    }
    if (pendingAmendment.description !== bet.description) amendmentChanges.push('Details updated');
    for (const r of roster) {
      const proposed = pendingAmendment.participants.find(
        (p) => p.user_id === r.participant.user_id,
      );
      if (!proposed || !r.commitment) continue;
      const who =
        r.participant.user_id === userId
          ? 'Your stake'
          : `${r.profile?.display_name ?? 'Their'} stake`;
      if (Number(proposed.stake_quantity) !== Number(r.commitment.stake_quantity)) {
        amendmentChanges.push(
          `${who}: ${r.commitment.stake_quantity} → ${proposed.stake_quantity}`,
        );
      }
    }
    const proposedCurrency = pendingAmendment.participants[0]?.currency_id;
    if (
      proposedCurrency &&
      myParticipant?.commitment &&
      proposedCurrency !== myParticipant.commitment.currency_id
    ) {
      const name = (currencies ?? []).find((c) => c.id === proposedCurrency)?.name;
      amendmentChanges.push(
        `Currency → ${name ?? (proposedCurrency === MONEY_CURRENCY_ID ? 'Money' : 'a different one')}`,
      );
    }
    if (amendmentChanges.length === 0) amendmentChanges.push('Same terms, re-confirmed');
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <div className="flex items-center justify-between">
        <BackButton />
        <div className="flex items-center gap-two">
          <StatusPill variant={pill.variant} label={pill.label} />
          {bet.deadline ? (
            <span className="text-sm text-text-secondary">{daysUntil(bet.deadline)}</span>
          ) : null}
          <button
            type="button"
            aria-label="More options"
            onClick={() => setMenuOpen(true)}
            className="-mr-two flex h-10 w-10 items-center justify-center rounded-pill text-text-secondary"
          >
            <Icons.more size={22} strokeWidth={2} />
          </button>
        </div>
      </div>

      <section className="mt-three flex flex-col items-center text-center">
        {roster.length === 2 && myParticipant && opponent ? (
          <div className="flex flex-col items-center gap-two">
            <Avatar
              id={opponent.participant.user_id}
              name={opponent.profile?.display_name ?? '?'}
              size="xl"
            />
            <p className="text-sm text-text-secondary">
              {bet.creator_id === opponent.participant.user_id &&
              bet.status === 'pending_acceptance' ? (
                <>
                  <span className="font-bold text-ink">
                    {opponent.profile?.display_name ?? 'Someone'}
                  </span>{' '}
                  is challenging you
                </>
              ) : (
                <>
                  You vs{' '}
                  <span className="font-bold text-ink">
                    {opponent.profile?.display_name ?? 'Unknown'}
                  </span>
                </>
              )}
            </p>
          </div>
        ) : null}

        <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
          {bet.title}
        </h1>
        {bet.description ? (
          <p className="mt-two max-w-[28ch] text-text-secondary">{bet.description}</p>
        ) : null}
      </section>

      {myParticipant?.commitment ? (
        <div className="mt-five grid grid-cols-2 gap-two text-center">
          <div className="rounded-large bg-up-soft px-three py-four">
            <p className="text-xs text-up-ink">If you win</p>
            <p className="mt-one font-display text-xl font-extrabold">
              {myParticipant.commitment.currencies?.icon ?? ''}{' '}
              {myParticipant.commitment.payout_if_win}
            </p>
            <p className="text-xs text-up-ink">
              {myParticipant.commitment.currencies?.name ?? ''} · you receive
            </p>
          </div>
          <div className="rounded-large bg-down-soft px-three py-four">
            <p className="text-xs text-down-ink">If you lose</p>
            <p className="mt-one font-display text-xl font-extrabold">
              {myParticipant.commitment.currencies?.icon ?? ''}{' '}
              {myParticipant.commitment.stake_quantity}
            </p>
            <p className="text-xs text-down-ink">
              {myParticipant.commitment.currencies?.name ?? ''} · you pay
            </p>
          </div>
        </div>
      ) : null}

      {roster.length === 2 && myParticipant && opponent && !genericSides ? (
        <div className="mt-three flex flex-col gap-one rounded-large border border-line bg-surface p-three text-center text-sm">
          <p>
            <span className="text-text-secondary">Your side:</span>{' '}
            <span className="font-bold">{myParticipant.side?.label}</span>
          </p>
          <p>
            <span className="text-text-secondary">
              {opponent.profile?.display_name ?? 'Their'} side:
            </span>{' '}
            <span className="font-bold">{opponent.side?.label}</span>
          </p>
        </div>
      ) : null}

      {roster.length > 2 ? (
        <>
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
              />
            ))}
          </div>
        </>
      ) : null}

      <InlineError message={error} />

      <div className="mt-four flex flex-col gap-three">
        {threadItems.map((item) => {
          if (item.kind === 'system') {
            return (
              <p key={item.id} className="text-center text-xs text-text-faint">
                {item.text}
              </p>
            );
          }

          {
            const mine = item.uploaderId === userId;
            return (
              <div key={item.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
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
        })}
      </div>

      {bet.status === 'pending_acceptance' && !myApprovalResponded ? (
        <>
          <div className="mt-five flex gap-two">
            <Button
              variant="primary"
              fullWidth
              onClick={() => handleApproval('approved', bet.current_version)}
            >
              Accept
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => handleApproval('declined', bet.current_version)}
            >
              Decline
            </Button>
          </div>
        </>
      ) : null}

      {bet.status === 'pending_acceptance' && myApprovalResponded ? (
        <p className="mt-five text-center text-sm text-text-secondary">
          Waiting for {opponentName} to accept
        </p>
      ) : null}

      {pendingAmendment ? (
        <div className="mt-five rounded-large border border-grape bg-grape-soft p-three">
          <p className="font-bold text-grape-ink">
            {pendingAmendment.proposed_by === userId
              ? `You asked ${opponentName} to change this bet`
              : `${opponentName} wants to change this bet`}
          </p>
          <ul className="mt-one list-disc pl-four text-sm text-grape-ink">
            {amendmentChanges.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-one text-xs text-grape-ink">
            Until it&rsquo;s accepted, the bet stays as you both agreed.
          </p>
          {pendingAmendment.proposed_by === userId ? (
            <Button
              variant="secondary"
              fullWidth
              className="mt-two"
              disabled={withdrawAmendment.isPending}
              onClick={() => run(withdrawAmendment.mutateAsync(pendingAmendment.id))}
            >
              Withdraw request
            </Button>
          ) : (
            <div className="mt-two flex gap-two">
              <Button
                variant="primary"
                fullWidth
                disabled={respondToAmendment.isPending}
                onClick={() =>
                  run(
                    respondToAmendment.mutateAsync({
                      amendmentId: pendingAmendment.id,
                      decision: 'approved',
                    }),
                  )
                }
              >
                Accept change
              </Button>
              <Button
                variant="secondary"
                fullWidth
                disabled={respondToAmendment.isPending}
                onClick={() =>
                  run(
                    respondToAmendment.mutateAsync({
                      amendmentId: pendingAmendment.id,
                      decision: 'declined',
                    }),
                  )
                }
              >
                Keep as is
              </Button>
            </div>
          )}
        </div>
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
          {deadlinePassed ? (
            <p className="mt-five text-center text-sm font-bold text-ink">
              The deadline has passed — time to call it.
            </p>
          ) : null}
          <Button
            variant="primary"
            fullWidth
            className={deadlinePassed ? 'mt-two' : 'mt-five'}
            onClick={() => navigate(`/bet/${bet.id}/result`)}
          >
            Who won?
          </Button>
        </>
      ) : null}

      {bet.status === 'pending_result' && pendingReport ? (
        <div className="mt-five rounded-large border border-line bg-surface p-three text-center">
          <p className="font-bold">
            {claimText(pendingReport.proposed_outcome_key, bet.result_reported_by === userId)}
          </p>
          {pendingReport.rationale ? (
            <p className="mt-one text-sm text-text-secondary">“{pendingReport.rationale}”</p>
          ) : null}
          {bet.result_due_at ? (
            <p className="mt-one text-xs text-text-faint">
              {awaitingMyConfirmation
                ? `Locks in ${timeUntil(bet.result_due_at)} unless you dispute it`
                : `Waiting for ${opponentName} · locks in ${timeUntil(bet.result_due_at)}`}
            </p>
          ) : null}
          {awaitingMyConfirmation ? (
            <div className="mt-three flex gap-two">
              <Button
                variant="primary"
                fullWidth
                disabled={confirmResult.isPending}
                onClick={() =>
                  run(
                    confirmResult.mutateAsync({
                      resultSubmissionId: pendingReport.id,
                      decision: 'approved',
                    }),
                  )
                }
              >
                That&rsquo;s right
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setPendingDispute(true)}>
                Dispute
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {bet.status === 'disputed' && myParticipant ? (
        <div className="mt-five rounded-large border border-danger bg-surface p-three text-center">
          <p className="font-bold">You don&rsquo;t agree on who won</p>
          <p className="mt-one text-sm text-text-secondary">
            Report what you think happened, or call the bet off — nobody owes anything if it&rsquo;s
            called off.
          </p>
          <div className="mt-three flex gap-two">
            <Button variant="primary" fullWidth onClick={() => navigate(`/bet/${bet.id}/result`)}>
              Who won?
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setPendingCallOff(true)}>
              Call it off
            </Button>
          </div>
        </div>
      ) : null}

      {(bet.status === 'resolved' || bet.status === 'tied') && bet.resolved_outcome_key ? (
        <>
          <SectionHeader title="Result" />
          <p className="mt-two text-text-secondary">{outcomeText(bet.resolved_outcome_key)}</p>
        </>
      ) : null}

      {bet.status === 'voided' ? (
        <p className="mt-five text-center text-sm text-text-secondary">
          {bet.void_reason === 'declined'
            ? 'This bet was declined, so it never started.'
            : bet.void_reason === 'withdrawn'
              ? 'This bet was withdrawn before it was accepted.'
              : bet.void_reason === 'cancelled'
                ? 'You both agreed to cancel this bet. Nobody owes anything.'
                : bet.void_reason === 'called_off'
                  ? 'This bet was called off after a dispute. Nobody owes anything.'
                  : bet.void_reason === 'expired'
                    ? 'Nobody answered this bet in time, so it expired.'
                    : 'This bet was voided.'}
        </p>
      ) : null}

      <ConfirmationDialog
        visible={pendingDispute}
        title="Dispute this result?"
        description={`${reporterName} will be told you disagree. Then either of you can report what you think happened, or call the bet off.`}
        confirmLabel="Dispute"
        cancelLabel="Go back"
        destructive
        onConfirm={() => {
          setPendingDispute(false);
          if (pendingReport) {
            run(
              confirmResult.mutateAsync({
                resultSubmissionId: pendingReport.id,
                decision: 'declined',
              }),
            );
          }
        }}
        onCancel={() => setPendingDispute(false)}
      />

      <ConfirmationDialog
        visible={pendingCallOff}
        title="Call this bet off?"
        description={`It ends right away for both of you and nobody owes anything. ${opponentName} gets notified.`}
        confirmLabel="Call it off"
        cancelLabel="Keep it open"
        destructive
        onConfirm={() => {
          setPendingCallOff(false);
          run(callOffBet.mutateAsync());
        }}
        onCancel={() => setPendingCallOff(false)}
      />

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

      {canEdit && isEditingDetails ? (
        <div className="mt-four rounded-medium border border-line bg-surface p-three">
          <SectionHeader title={editMode ? editCopy[editMode].header : 'Edit bet'} />
          {editMode === 'amend' ? (
            <p className="mt-one text-xs text-text-secondary">
              {opponentName} has to accept before anything changes.
            </p>
          ) : null}
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
              disabled={editBetDetails.isPending || proposeAmendment.isPending}
              onClick={submitEditDetails}
            >
              {editMode ? editCopy[editMode].submit : 'Save changes'}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setIsEditingDetails(false)}>
              Cancel
            </Button>
          </div>
        </div>
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

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          ...(canEdit
            ? [
                {
                  label: editMode ? editCopy[editMode].menu : 'Edit bet',
                  onSelect: () => {
                    setMenuOpen(false);
                    openEditDetails();
                  },
                },
              ]
            : []),
          ...(canWithdraw
            ? [
                {
                  label: 'Delete bet',
                  destructive: true,
                  onSelect: () => {
                    setMenuOpen(false);
                    setPendingWithdraw(true);
                  },
                },
              ]
            : []),
          ...(canCancel
            ? [
                {
                  label: 'Cancel bet',
                  destructive: true,
                  onSelect: () => {
                    setMenuOpen(false);
                    setPendingCancel(true);
                  },
                },
              ]
            : []),
          {
            label: 'Report this bet',
            destructive: true,
            onSelect: () => {
              setMenuOpen(false);
              setReportTarget({ type: 'bet', id: bet.id });
            },
          },
        ]}
      />

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
    </main>
  );
}
