import { useState } from 'react';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { useFriends } from '@/hooks/use-friends';
import {
  useApproveManualObligation,
  useCancelManualObligation,
  useDeclineManualObligation,
  useManualObligations,
  useProposeManualObligation,
} from '@/hooks/use-manual-obligations';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import type { ManualObligationStatus } from '@/lib/manual-obligation';

const STATUS_VARIANT: Record<ManualObligationStatus, StatusPillVariant> = {
  pending: 'pending',
  approved: 'won',
  declined: 'lost',
  cancelled: 'tied',
};

function Chip({
  label,
  selected,
  onClick,
  tone = 'grape',
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  tone?: 'grape' | 'ink';
}) {
  const selectedClasses = tone === 'grape' ? 'bg-grape text-on-grape' : 'bg-ink text-bg';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill px-three py-two text-sm font-bold whitespace-nowrap ${
        selected ? selectedClasses : 'border border-line bg-surface text-ink'
      }`}
    >
      {label}
    </button>
  );
}

export function ObligationsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { friends } = useFriends(userId);
  const { incoming, outgoing, resolved, currencies } = useManualObligations(userId);
  const propose = useProposeManualObligation(userId);
  const approve = useApproveManualObligation(userId);
  const decline = useDeclineManualObligation(userId);
  const cancel = useCancelManualObligation(userId);

  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [iOwe, setIOwe] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const currencyId = selectedCurrencyId ?? currencies[0]?.id ?? null;
  const parsedAmount = Number(amount);
  const canPropose =
    !!userId &&
    !!selectedFriendId &&
    !!currencyId &&
    !!description.trim() &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0;

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  function handlePropose() {
    if (!userId || !selectedFriendId || !currencyId) return;
    setError(null);
    propose.mutate(
      {
        debtorId: iOwe ? userId : selectedFriendId,
        creditorId: iOwe ? selectedFriendId : userId,
        currencyId,
        amount: parsedAmount,
        description: description.trim(),
      },
      {
        onSuccess: () => {
          setSelectedFriendId(null);
          setAmount('');
          setDescription('');
        },
        onError: (err) => setError(getErrorMessage(err, 'Failed to propose obligation')),
      },
    );
  }

  function rowTitle(iAmDebtor: boolean, counterpartyName: string | undefined) {
    return iAmDebtor
      ? `You owe ${counterpartyName ?? 'them'}`
      : `${counterpartyName ?? 'They'} owe(s) you`;
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Obligations
      </h1>
      <p className="mt-two text-text-secondary">
        Log a one-off obligation with a friend outside of a bet — it only becomes real once they
        approve it too.
      </p>

      <InlineError message={error} />

      <SectionHeader title="Propose one" />
      {friends.length === 0 ? (
        <p className="mt-two text-sm text-text-secondary">
          Add a friend first to propose a manual obligation with them.
        </p>
      ) : (
        <div className="mt-two flex flex-col gap-three rounded-large border border-line bg-surface p-three">
          <div>
            <p className="text-sm font-bold text-text-secondary">Who</p>
            <div className="mt-two flex flex-wrap gap-two">
              {friends.map(({ profile }) => (
                <Chip
                  key={profile.id}
                  label={profile.display_name}
                  selected={selectedFriendId === profile.id}
                  onClick={() => setSelectedFriendId(profile.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-text-secondary">Direction</p>
            <div className="mt-two flex gap-two">
              <Chip label="I owe them" selected={iOwe} onClick={() => setIOwe(true)} tone="ink" />
              <Chip
                label="They owe me"
                selected={!iOwe}
                onClick={() => setIOwe(false)}
                tone="ink"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-text-secondary">Currency</p>
            <div className="mt-two flex flex-wrap gap-two">
              {currencies.map((currency) => (
                <Chip
                  key={currency.id}
                  label={`${currency.icon ? `${currency.icon} ` : ''}${currency.name}`}
                  selected={currencyId === currency.id}
                  onClick={() => setSelectedCurrencyId(currency.id)}
                />
              ))}
            </div>
          </div>

          <input
            placeholder="Amount, e.g. 1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="rounded-medium border border-line bg-bg p-three"
          />
          <input
            placeholder="What for, e.g. Gas money"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-medium border border-line bg-bg p-three"
          />

          <Button disabled={!canPropose || propose.isPending} onClick={handlePropose}>
            {propose.isPending ? 'Proposing…' : 'Propose'}
          </Button>
        </div>
      )}

      {incoming.length > 0 ? (
        <>
          <SectionHeader title="Awaiting your response" />
          <div className="mt-two flex flex-col gap-two">
            {incoming.map(({ proposal, counterparty, currency, iAmDebtor }) => (
              <ListRow
                key={proposal.id}
                title={rowTitle(iAmDebtor, counterparty?.display_name)}
                subtitle={proposal.description}
                trailing={
                  <div className="flex items-center gap-two">
                    {currency ? (
                      <span className="font-mono text-sm text-text-secondary">
                        {proposal.amount} {currency.name}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => run(approve.mutateAsync(proposal.id))}
                      className="rounded-pill bg-grape px-three py-one text-sm font-bold text-on-grape"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => run(decline.mutateAsync(proposal.id))}
                      className="rounded-pill bg-surface-sunken px-three py-one text-sm font-bold text-text-secondary"
                    >
                      Decline
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      {outgoing.length > 0 ? (
        <>
          <SectionHeader title="Waiting on them" />
          <div className="mt-two flex flex-col gap-two">
            {outgoing.map(({ proposal, counterparty, currency, iAmDebtor }) => (
              <ListRow
                key={proposal.id}
                title={rowTitle(iAmDebtor, counterparty?.display_name)}
                subtitle={proposal.description}
                trailing={
                  <div className="flex items-center gap-two">
                    {currency ? (
                      <span className="font-mono text-sm text-text-secondary">
                        {proposal.amount} {currency.name}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCancelTargetId(proposal.id)}
                      className="text-sm font-bold text-text-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="History" />
      {resolved.length === 0 ? (
        <p className="mt-two text-sm text-text-secondary">
          Approved, declined, and cancelled obligations will show up here.
        </p>
      ) : (
        <div className="mt-two flex flex-col gap-two">
          {resolved.map(({ proposal, counterparty, currency, iAmDebtor }) => (
            <ListRow
              key={proposal.id}
              title={rowTitle(iAmDebtor, counterparty?.display_name)}
              subtitle={proposal.description}
              trailing={
                <div className="flex items-center gap-two">
                  {currency ? (
                    <span className="font-mono text-sm text-text-secondary">
                      {proposal.amount} {currency.name}
                    </span>
                  ) : null}
                  <StatusPill
                    variant={STATUS_VARIANT[proposal.status]}
                    label={proposal.status[0].toUpperCase() + proposal.status.slice(1)}
                  />
                </div>
              }
            />
          ))}
        </div>
      )}

      <ConfirmationDialog
        visible={cancelTargetId !== null}
        title="Cancel this proposal?"
        description="The other person will no longer be able to approve it."
        confirmLabel="Cancel proposal"
        destructive
        onConfirm={() => {
          if (cancelTargetId) run(cancel.mutateAsync(cancelTargetId));
          setCancelTargetId(null);
        }}
        onCancel={() => setCancelTargetId(null)}
      />
    </main>
  );
}
