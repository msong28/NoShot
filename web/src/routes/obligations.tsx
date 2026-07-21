import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge, type BadgeVariant } from '@/components/ui/badge';
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

const STATUS_VARIANT: Record<ManualObligationStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  declined: 'danger',
  cancelled: 'neutral',
};

export function ObligationsScreen() {
  const navigate = useNavigate();
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
    <main className="mx-auto max-w-app p-four pb-28">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="font-display text-sm text-text-secondary"
      >
        ← Back
      </button>

      <h1 className="mt-three font-display text-2xl font-extrabold">Obligations</h1>
      <p className="mt-two text-sm text-text-secondary">
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
        <div className="mt-two flex flex-col gap-three">
          <div>
            <p className="text-sm text-text-secondary">Who</p>
            <div className="mt-two flex flex-wrap gap-two">
              {friends.map(({ profile }) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelectedFriendId(profile.id)}
                  className={`rounded-pill px-three py-two font-display text-sm font-bold ${
                    selectedFriendId === profile.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-sunken text-text-secondary'
                  }`}
                >
                  {profile.display_name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-text-secondary">Direction</p>
            <div className="mt-two flex gap-two">
              <button
                type="button"
                onClick={() => setIOwe(true)}
                className={`rounded-pill px-three py-two font-display text-sm font-bold ${
                  iOwe ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-text-secondary'
                }`}
              >
                I owe them
              </button>
              <button
                type="button"
                onClick={() => setIOwe(false)}
                className={`rounded-pill px-three py-two font-display text-sm font-bold ${
                  !iOwe ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-text-secondary'
                }`}
              >
                They owe me
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm text-text-secondary">Currency</p>
            <div className="mt-two flex flex-wrap gap-two">
              {currencies.map((currency) => (
                <button
                  key={currency.id}
                  type="button"
                  onClick={() => setSelectedCurrencyId(currency.id)}
                  className={`rounded-pill px-three py-two font-display text-sm font-bold ${
                    currencyId === currency.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-sunken text-text-secondary'
                  }`}
                >
                  {currency.icon ? `${currency.icon} ` : ''}
                  {currency.name}
                </button>
              ))}
            </div>
          </div>

          <input
            placeholder="Amount, e.g. 1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="rounded-medium bg-surface p-three shadow-card"
          />
          <input
            placeholder="What for, e.g. Gas money"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-medium bg-surface p-three shadow-card"
          />

          <button
            type="button"
            disabled={!canPropose || propose.isPending}
            onClick={handlePropose}
            className="self-start rounded-pill bg-primary px-four py-three font-display font-bold text-on-primary disabled:opacity-60"
          >
            Propose
          </button>
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
                      <span className="text-sm text-text-secondary">
                        {proposal.amount} {currency.name}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => run(approve.mutateAsync(proposal.id))}
                      className="rounded-pill bg-primary px-three py-one font-display text-sm font-bold text-on-primary"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => run(decline.mutateAsync(proposal.id))}
                      className="rounded-pill bg-surface-sunken px-three py-one font-display text-sm font-bold text-text-secondary"
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
                      <span className="text-sm text-text-secondary">
                        {proposal.amount} {currency.name}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCancelTargetId(proposal.id)}
                      className="font-display text-sm font-bold text-text-secondary"
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
                    <span className="text-sm text-text-secondary">
                      {proposal.amount} {currency.name}
                    </span>
                  ) : null}
                  <StatusBadge
                    label={proposal.status[0].toUpperCase() + proposal.status.slice(1)}
                    variant={STATUS_VARIANT[proposal.status]}
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

      <BottomNav />
    </main>
  );
}
