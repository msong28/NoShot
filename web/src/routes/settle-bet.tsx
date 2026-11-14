import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { SettleReveal, type SettleOutcome } from '@/components/ui/settle-reveal';
import { useBetDetail, useProposeCancelBet, useSubmitBetResult } from '@/hooks/use-bets';
import { useUploadProof } from '@/hooks/use-proof';
import { useSession } from '@/hooks/use-session';
import { TIE_OUTCOME_KEY } from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';

type Choice =
  | { kind: 'outcome'; key: string; label: string }
  | { kind: 'tie'; key: string; label: string }
  | { kind: 'inconclusive'; key: 'inconclusive'; label: string };

/** Default side labels ("You", the rival's name) say nothing on their own --
 * lead with "I won" / "{Name} won" there, and with the real label for lines
 * and custom win conditions ("Over 2.5 wins"). */
function winLabel(label: string | undefined, fallback: string, generic: boolean): string {
  return generic || !label ? fallback : `${label} wins`;
}

/**
 * Dedicated "what happened?" page, opened from the bet's Settle bet button.
 * Whoever reports the outcome settles it right away (a recorded product
 * decision -- see DECISIONS.md), so the page picks the outcome, takes an
 * optional note and photo, and asks for one last confirmation before it
 * posts. "Inconclusive" doesn't settle anything: it proposes cancelling,
 * which the other side has to agree to.
 */
export function SettleBetScreen() {
  const { betId } = useParams<{ betId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const { bet, roster, resultSubmissions, isLoading } = useBetDetail(betId);
  const submitBetResult = useSubmitBetResult(betId, userId);
  const proposeCancelBet = useProposeCancelBet(betId, userId);
  const uploadProof = useUploadProof(betId, userId);

  const [choice, setChoice] = useState<Choice | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revealOutcome, setRevealOutcome] = useState<SettleOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !bet) {
    return (
      <main className="mx-auto max-w-app p-four">
        <BackButton />
        <p className="mt-four text-text-secondary">Loading…</p>
      </main>
    );
  }

  const me = roster.find((r) => r.participant.user_id === userId);
  const other =
    roster.length === 2 ? roster.find((r) => r.participant.user_id !== userId) : undefined;
  const alreadyReported = resultSubmissions.length > 0;

  // Only a running bet nobody has reported on can be settled from here.
  if (bet.status !== 'active' || alreadyReported || !me) {
    return <Navigate to={`/bet/${bet.id}`} replace />;
  }

  const otherName = other?.profile?.display_name ?? 'They';
  const rosterNames = new Set(roster.map((r) => r.profile?.display_name));
  const isGeneric = (label?: string) =>
    !label || label === 'You' || label === 'Them' || rosterNames.has(label);

  const choices: Choice[] = [
    {
      kind: 'outcome',
      key: me.side?.outcome_key ?? '',
      label: winLabel(me.side?.label, 'I won', isGeneric(me.side?.label)),
    },
    ...(other
      ? [
          {
            kind: 'outcome' as const,
            key: other.side?.outcome_key ?? '',
            label: winLabel(other.side?.label, `${otherName} won`, isGeneric(other.side?.label)),
          },
        ]
      : []),
    { kind: 'tie', key: TIE_OUTCOME_KEY, label: 'It was a tie' },
    { kind: 'inconclusive', key: 'inconclusive', label: "Couldn't tell / call it off" },
  ];

  const selectedLabel = choice?.label ?? '';

  async function handleConfirm() {
    if (!choice) return;
    setConfirming(false);
    setError(null);
    try {
      if (choice.kind === 'inconclusive') {
        await proposeCancelBet.mutateAsync(undefined);
        navigate(`/bet/${bet!.id}`, { replace: true });
        return;
      }
      if (photo) await uploadProof.mutateAsync({ file: photo, caption: note.trim() || undefined });
      const updated = await submitBetResult.mutateAsync({
        outcomeKey: choice.key,
        rationale: note.trim() || undefined,
      });
      if (updated.status === 'tied') setRevealOutcome('tied');
      else if (updated.status === 'resolved') {
        setRevealOutcome(updated.resolved_outcome_key === me?.side?.outcome_key ? 'won' : 'lost');
      } else {
        navigate(`/bet/${bet!.id}`, { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong'));
    }
  }

  const busy = submitBetResult.isPending || proposeCancelBet.isPending || uploadProof.isPending;

  return (
    <main className="mx-auto max-w-app p-four pb-six">
      <BackButton />

      <div className="mt-three text-center">
        <p className="text-sm text-text-secondary">Settling</p>
        <h1 className="mt-one font-display text-screen-title font-extrabold tracking-display-tight">
          {bet.title}
        </h1>
        <p className="mt-two text-text-secondary">What happened?</p>
      </div>

      <InlineError message={error} />

      <div role="radiogroup" aria-label="Outcome" className="mt-four flex flex-col gap-two">
        {choices.map((c) => {
          const selected = choice?.key === c.key && choice.kind === c.kind;
          return (
            <button
              key={`${c.kind}:${c.key}`}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(c)}
              className={`rounded-large border p-three text-left font-bold ${
                selected
                  ? 'border-grape bg-grape-soft text-grape-ink'
                  : 'border-line bg-surface text-ink'
              } ${c.kind === 'inconclusive' ? 'font-normal text-text-secondary' : ''}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {choice && choice.kind !== 'inconclusive' ? (
        <div className="mt-four flex flex-col gap-two">
          <textarea
            aria-label="What happened (optional)"
            placeholder="What happened? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-medium border border-line bg-surface p-three"
          />
          <label className="flex cursor-pointer items-center gap-two text-sm font-bold text-text-secondary">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <span className="rounded-pill border border-line bg-surface px-three py-two">
              {photo ? 'Change photo' : 'Add proof photo (optional)'}
            </span>
            {photo ? <span className="truncate font-normal">{photo.name}</span> : null}
          </label>
        </div>
      ) : null}

      <Button
        variant="primary"
        fullWidth
        className="mt-five"
        disabled={!choice || busy}
        onClick={() => setConfirming(true)}
      >
        {choice?.kind === 'inconclusive' ? 'Propose calling it off' : 'Settle bet'}
      </Button>

      <ConfirmationDialog
        visible={confirming}
        destructive={choice?.kind === 'inconclusive'}
        title={
          choice?.kind === 'inconclusive'
            ? 'Propose calling this bet off?'
            : `Settle as “${selectedLabel}”?`
        }
        description={
          choice?.kind === 'inconclusive'
            ? `${otherName} has to agree before it's cancelled. Nothing is owed if it is.`
            : `This is final. It settles the bet right away and ${otherName} gets notified.`
        }
        confirmLabel={choice?.kind === 'inconclusive' ? 'Propose' : 'Settle it'}
        cancelLabel="Go back"
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />

      {revealOutcome ? (
        <SettleReveal
          outcome={revealOutcome}
          betTitle={bet.title}
          opponentName={otherName}
          amount={
            revealOutcome === 'won'
              ? (me.commitment?.payout_if_win ?? 0)
              : (me.commitment?.stake_quantity ?? 0)
          }
          currencyName={me.commitment?.currencies?.name}
          currencyIcon={me.commitment?.currencies?.icon}
          onDone={() => navigate('/bets?tab=done', { replace: true })}
        />
      ) : null}
    </main>
  );
}
