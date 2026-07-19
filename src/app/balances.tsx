import { router } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CurrencyLabel } from '@/components/ui/currency-label';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { useLedgerEntriesBetween, useMyBalances } from '@/hooks/use-ledger';
import {
  useCancelRedemption,
  useConfirmRedemption,
  useDeclineRedemption,
  useForgiveObligation,
  useMyRedemptions,
  useOutstandingObligations,
  useRequestRedemption,
} from '@/hooks/use-redemption';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import type { LedgerSourceType } from '@/lib/ledger';

const SOURCE_LABEL: Record<LedgerSourceType, string> = {
  bet: 'Bet settlement',
  manual_obligation: 'Manual obligation',
  redemption: 'Redemption',
  forgiveness: 'Forgiveness',
};

function balanceKey(counterpartyId: string, currencyId: string, groupId: string | null) {
  return `${counterpartyId}:${currencyId}:${groupId ?? ''}`;
}

export default function BalancesScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { rows, isLoading } = useMyBalances(userId);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const selected = rows.find(
    (row) =>
      balanceKey(row.balance.counterparty_id, row.balance.currency_id, row.balance.group_id) ===
      selectedKey,
  );

  const entriesQuery = useLedgerEntriesBetween(
    userId,
    selected?.balance.counterparty_id,
    selected?.balance.currency_id,
    selected?.balance.group_id,
  );

  const outstandingQuery = useOutstandingObligations(
    userId,
    selected?.balance.counterparty_id,
    selected?.balance.currency_id,
    selected?.balance.group_id,
  );

  const { needsMyConfirmation, waitingOnThem } = useMyRedemptions(userId);
  const requestRedemption = useRequestRedemption(userId);
  const confirmRedemption = useConfirmRedemption(userId);
  const declineRedemption = useDeclineRedemption(userId);
  const cancelRedemption = useCancelRedemption(userId);
  const forgiveObligation = useForgiveObligation(userId);

  function runAction(action: Promise<unknown>) {
    setError(null);
    action.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  function amountFor(sourceEntryId: string, outstanding: number) {
    return amountDrafts[sourceEntryId] ?? String(outstanding);
  }

  const relevantIncoming = needsMyConfirmation.filter(
    (row) => row.counterparty?.id === selected?.balance.counterparty_id,
  );
  const relevantOutgoing = waitingOnThem.filter(
    (row) => row.counterparty?.id === selected?.balance.counterparty_id,
  );

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Balances</ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        Net amounts owed between you and each person, by currency -- from resolved bets and approved
        obligations.
      </ThemedText>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon="balances"
          title="All settled up"
          description="Resolved bets and approved obligations will show up here as balances."
        />
      ) : (
        rows.map(({ balance, counterparty, currency }) => {
          const key = balanceKey(balance.counterparty_id, balance.currency_id, balance.group_id);
          const isSelected = key === selectedKey;
          const theyOweYou = balance.net_amount > 0;
          return (
            <ListRow
              key={key}
              leading={
                counterparty ? (
                  <Avatar id={counterparty.id} name={counterparty.display_name} />
                ) : undefined
              }
              title={counterparty?.display_name ?? 'Unknown'}
              subtitle={theyOweYou ? 'Owes you' : 'You owe'}
              trailing={
                currency ? (
                  <CurrencyLabel quantity={Math.abs(balance.net_amount)} currency={currency} />
                ) : null
              }
              onPress={() => setSelectedKey(isSelected ? null : key)}
            />
          );
        })
      )}

      {selected ? (
        <>
          <InlineError message={error} />

          {relevantIncoming.length > 0 ? (
            <>
              <SectionHeader title="Needs your confirmation" />
              {relevantIncoming.map(({ request }) => (
                <ListRow
                  key={request.id}
                  title="Redemption requested"
                  subtitle={`They say they've settled ${request.amount}`}
                  trailing={
                    <>
                      <Button
                        variant="primary"
                        onPress={() => runAction(confirmRedemption.mutateAsync(request.id))}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="muted"
                        onPress={() => runAction(declineRedemption.mutateAsync(request.id))}
                      >
                        Decline
                      </Button>
                    </>
                  }
                />
              ))}
            </>
          ) : null}

          {relevantOutgoing.length > 0 ? (
            <>
              <SectionHeader title="Waiting on them" />
              {relevantOutgoing.map(({ request }) => (
                <ListRow
                  key={request.id}
                  title="Redemption requested"
                  subtitle={`Waiting for them to confirm ${request.amount}`}
                  trailing={
                    <Button
                      variant="muted"
                      onPress={() => runAction(cancelRedemption.mutateAsync(request.id))}
                    >
                      Cancel
                    </Button>
                  }
                />
              ))}
            </>
          ) : null}

          <SectionHeader title="Settle up" />
          {(outstandingQuery.data ?? []).length === 0 ? (
            <ThemedText type="bodySM" themeColor="textMuted">
              {outstandingQuery.isLoading ? 'Loading…' : 'Nothing outstanding to settle.'}
            </ThemedText>
          ) : (
            (outstandingQuery.data ?? []).map((obligation) => {
              const iAmDebtor = obligation.debtor_id === userId;
              const draft = amountFor(obligation.source_entry_id, obligation.outstanding_amount);
              return (
                <ListRow
                  key={obligation.source_entry_id}
                  title={SOURCE_LABEL[obligation.source_type]}
                  subtitle={
                    iAmDebtor
                      ? `You owe -- ${obligation.outstanding_amount} outstanding`
                      : `They owe you -- ${obligation.outstanding_amount} outstanding`
                  }
                  trailing={
                    <>
                      <TextField
                        label="Amount"
                        value={draft}
                        onChangeText={(text) =>
                          setAmountDrafts((prev) => ({
                            ...prev,
                            [obligation.source_entry_id]: text,
                          }))
                        }
                        keyboardType="numeric"
                      />
                      {iAmDebtor ? (
                        <Button
                          variant="primary"
                          onPress={() =>
                            runAction(
                              requestRedemption.mutateAsync([
                                {
                                  source_entry_id: obligation.source_entry_id,
                                  amount: Number(draft),
                                },
                              ]),
                            )
                          }
                        >
                          Redeem
                        </Button>
                      ) : (
                        <Button
                          variant="muted"
                          onPress={() =>
                            runAction(
                              forgiveObligation.mutateAsync({
                                allocations: [
                                  {
                                    source_entry_id: obligation.source_entry_id,
                                    amount: Number(draft),
                                  },
                                ],
                              }),
                            )
                          }
                        >
                          Forgive
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })
          )}

          <SectionHeader
            title={`History with ${selected.counterparty?.display_name ?? 'this person'}`}
          />
          {(entriesQuery.data ?? []).length === 0 ? (
            <ThemedText type="bodySM" themeColor="textMuted">
              {entriesQuery.isLoading ? 'Loading…' : 'No entries found.'}
            </ThemedText>
          ) : (
            (entriesQuery.data ?? []).map((entry) => {
              const youAreDebtor = entry.debtor_id === userId;
              return (
                <ListRow
                  key={entry.id}
                  title={SOURCE_LABEL[entry.source_type]}
                  subtitle={youAreDebtor ? 'You owed' : 'They owed you'}
                  trailing={
                    selected.currency ? (
                      <CurrencyLabel quantity={entry.amount} currency={selected.currency} />
                    ) : null
                  }
                />
              );
            })
          )}
        </>
      ) : null}
    </Screen>
  );
}
