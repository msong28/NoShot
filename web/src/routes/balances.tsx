import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
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
      className="rounded-pill bg-primary px-three py-one font-display text-sm font-bold text-on-primary disabled:opacity-60"
    >
      Settle up
    </button>
  );
}

export function BalancesScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { rows: balanceRows, isLoading } = useMyBalances(userId);
  const { needsMyConfirmation, waitingOnThem, isLoading: isRedemptionsLoading } =
    useMyRedemptions(userId);
  const confirmRedemption = useConfirmRedemption(userId);
  const declineRedemption = useDeclineRedemption(userId);
  const cancelRedemption = useCancelRedemption(userId);

  const [error, setError] = useState<string | null>(null);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <h1 className="mt-three font-display text-2xl font-extrabold">Balances</h1>

      <InlineError message={error} />

      {needsMyConfirmation.length > 0 ? (
        <>
          <SectionHeader title="Waiting on your confirmation" />
          <div className="mt-two flex flex-col gap-two">
            {needsMyConfirmation.map(({ request, counterparty }) => (
              <ListRow
                key={request.id}
                leading={<Avatar id={counterparty?.id ?? request.id} name={counterparty?.display_name ?? '?'} />}
                title={counterparty?.display_name ?? 'Someone'}
                subtitle={`Says they paid ${request.amount}`}
                trailing={
                  <div className="flex gap-two">
                    <button
                      type="button"
                      onClick={() => run(confirmRedemption.mutateAsync(request.id))}
                      className="rounded-pill bg-primary px-three py-one font-display text-sm font-bold text-on-primary"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => run(declineRedemption.mutateAsync(request.id))}
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

      {waitingOnThem.length > 0 ? (
        <>
          <SectionHeader title="Waiting on them" />
          <div className="mt-two flex flex-col gap-two">
            {waitingOnThem.map(({ request, counterparty }) => (
              <ListRow
                key={request.id}
                leading={<Avatar id={counterparty?.id ?? request.id} name={counterparty?.display_name ?? '?'} />}
                title={counterparty?.display_name ?? 'Someone'}
                subtitle={`You said you paid ${request.amount}`}
                trailing={
                  <button
                    type="button"
                    onClick={() => run(cancelRedemption.mutateAsync(request.id))}
                    className="font-display text-sm font-bold text-danger"
                  >
                    Cancel
                  </button>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Net balances" />
      <div className="mt-two flex flex-col gap-two">
        {isLoading || isRedemptionsLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : balanceRows.length === 0 ? (
          <EmptyState icon="balances" title="All settled up" description="No outstanding balances with anyone." />
        ) : (
          balanceRows.map(({ balance, counterparty, currency }) => (
            <ListRow
              key={`${balance.counterparty_id}:${balance.currency_id}:${balance.group_id ?? 'none'}`}
              leading={<Avatar id={balance.counterparty_id} name={counterparty?.display_name ?? '?'} />}
              title={counterparty?.display_name ?? 'Unknown'}
              subtitle={`${balance.net_amount > 0 ? 'Owes you' : 'You owe'} ${Math.abs(balance.net_amount)} ${currency?.name ?? ''}`}
              trailing={
                balance.net_amount < 0 ? (
                  <SettleUpButton
                    userId={userId}
                    counterpartyId={balance.counterparty_id}
                    currencyId={balance.currency_id}
                    groupId={balance.group_id}
                    onError={setError}
                  />
                ) : undefined
              }
            />
          ))
        )}
      </div>
    </main>
  );
}
