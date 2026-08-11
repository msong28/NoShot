import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { DebtChip } from '@/components/ui/debt-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconTile } from '@/components/ui/icon-tile';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import {
  useCancelRedemption,
  useConfirmRedemption,
  useDeclineRedemption,
  useMyRedemptions,
  useOutstandingObligations,
  useRequestRedemption,
} from '@/hooks/use-redemption';
import { useMyBalances } from '@/hooks/use-ledger';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import type { Allocation } from '@/lib/redemption';

function SettleUpButton({
  userId,
  counterpartyId,
  currencyId,
  groupId,
  onError,
}: {
  userId: string | undefined;
  counterpartyId: string;
  currencyId: string;
  groupId: string | null;
  onError: (message: string) => void;
}) {
  const outstanding = useOutstandingObligations(userId, counterpartyId, currencyId, groupId);
  const requestRedemption = useRequestRedemption(userId);

  function handleClick() {
    const allocations: Allocation[] = (outstanding.data ?? []).map((o) => ({
      source_entry_id: o.source_entry_id,
      amount: o.outstanding_amount,
    }));
    if (allocations.length === 0) return;
    requestRedemption
      .mutateAsync(allocations)
      .catch((err: unknown) => onError(getErrorMessage(err, 'Could not request settlement')));
  }

  return (
    <button
      type="button"
      disabled={requestRedemption.isPending || (outstanding.data ?? []).length === 0}
      onClick={handleClick}
      className="rounded-pill bg-grape px-three py-one text-sm font-bold text-on-grape disabled:opacity-60"
    >
      Settle up
    </button>
  );
}

export function BalancesScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { rows: balanceRows, isLoading } = useMyBalances(userId);
  const {
    needsMyConfirmation,
    waitingOnThem,
    isLoading: isRedemptionsLoading,
  } = useMyRedemptions(userId);
  const confirmRedemption = useConfirmRedemption(userId);
  const declineRedemption = useDeclineRedemption(userId);
  const cancelRedemption = useCancelRedemption(userId);

  const [error, setError] = useState<string | null>(null);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  const owedToYouRows = balanceRows.filter((r) => r.balance.net_amount > 0);
  const youOweRows = balanceRows.filter((r) => r.balance.net_amount < 0);
  const distinctFriends = new Set(owedToYouRows.map((r) => r.balance.counterparty_id)).size;

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Cash in
      </h1>
      <p className="mt-two text-text-secondary">
        {owedToYouRows.length > 0
          ? `You're owed ${owedToYouRows.length} favor${owedToYouRows.length === 1 ? '' : 's'} across ${distinctFriends} friend${distinctFriends === 1 ? '' : 's'}.`
          : "You're not owed anything right now."}
      </p>

      <InlineError message={error} />

      {owedToYouRows.length > 0 ? (
        <div className="mt-three flex flex-col gap-two">
          {owedToYouRows.map(({ balance, counterparty, currency }) => (
            <ListRow
              key={`${balance.counterparty_id}:${balance.currency_id}:${balance.group_id ?? 'none'}`}
              leading={<IconTile tone="success">{currency?.icon ?? '🎯'}</IconTile>}
              title={currency?.name ?? 'Favor'}
              subtitle={`from ${counterparty?.display_name ?? 'someone'}`}
              trailing={
                <DebtChip direction="up" label={`${balance.net_amount} ${currency?.name ?? ''}`} />
              }
            />
          ))}
        </div>
      ) : null}

      <div className="mt-three flex items-center gap-two rounded-medium bg-surface-sunken p-three">
        <span className="text-lg">🔒</span>
        <p className="text-sm text-text-secondary">
          Settling up pings your friend to confirm they paid. Both of you keep a record.
        </p>
      </div>

      {needsMyConfirmation.length > 0 ? (
        <>
          <SectionHeader title="Waiting on your confirmation" />
          <div className="mt-two flex flex-col gap-two">
            {needsMyConfirmation.map(({ request, counterparty }) => (
              <ListRow
                key={request.id}
                leading={
                  <Avatar
                    id={counterparty?.id ?? request.id}
                    name={counterparty?.display_name ?? '?'}
                  />
                }
                title={counterparty?.display_name ?? 'Someone'}
                subtitle={`Says they paid ${request.amount}`}
                trailing={
                  <div className="flex gap-two">
                    <button
                      type="button"
                      onClick={() => run(confirmRedemption.mutateAsync(request.id))}
                      className="rounded-pill bg-grape px-three py-one text-sm font-bold text-on-grape"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => run(declineRedemption.mutateAsync(request.id))}
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

      {waitingOnThem.length > 0 ? (
        <>
          <SectionHeader title="Waiting on them" />
          <div className="mt-two flex flex-col gap-two">
            {waitingOnThem.map(({ request, counterparty }) => (
              <ListRow
                key={request.id}
                leading={
                  <Avatar
                    id={counterparty?.id ?? request.id}
                    name={counterparty?.display_name ?? '?'}
                  />
                }
                title={counterparty?.display_name ?? 'Someone'}
                subtitle={`You said you paid ${request.amount}`}
                trailing={
                  <button
                    type="button"
                    onClick={() => run(cancelRedemption.mutateAsync(request.id))}
                    className="text-sm font-bold text-danger-ink"
                  >
                    Cancel
                  </button>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="You owe" />
      <div className="mt-two flex flex-col gap-two">
        {isLoading || isRedemptionsLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : youOweRows.length === 0 ? (
          <EmptyState
            icon="balances"
            title="All settled up"
            description="You don't owe anyone right now."
          />
        ) : (
          youOweRows.map(({ balance, counterparty, currency }) => (
            <ListRow
              key={`${balance.counterparty_id}:${balance.currency_id}:${balance.group_id ?? 'none'}`}
              leading={
                <Avatar id={balance.counterparty_id} name={counterparty?.display_name ?? '?'} />
              }
              title={counterparty?.display_name ?? 'Unknown'}
              trailing={
                <div className="flex flex-col items-end gap-one">
                  <DebtChip
                    direction="down"
                    label={`${Math.abs(balance.net_amount)} ${currency?.name ?? ''}`}
                  />
                  <SettleUpButton
                    userId={userId}
                    counterpartyId={balance.counterparty_id}
                    currencyId={balance.currency_id}
                    groupId={balance.group_id}
                    onError={setError}
                  />
                </div>
              }
            />
          ))
        )}
      </div>
    </main>
  );
}
