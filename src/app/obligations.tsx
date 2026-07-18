import { router } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { CurrencyLabel } from '@/components/ui/currency-label';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextField } from '@/components/ui/text-field';
import type { StatusVariant } from '@/constants/component-variants';
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

const STATUS_VARIANT: Record<ManualObligationStatus, StatusVariant> = {
  pending: 'warning',
  approved: 'success',
  declined: 'danger',
  cancelled: 'neutral',
};

export default function ObligationsScreen() {
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
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(
    currencies[0]?.id ?? null,
  );
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

  function runAction(action: Promise<unknown>) {
    setError(null);
    action.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
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

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Obligations</ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        Log a one-off obligation with a friend outside of a bet -- it only becomes real once they
        approve it too.
      </ThemedText>

      <SectionHeader title="Propose one" />
      {friends.length === 0 ? (
        <EmptyState
          icon="friends"
          title="No friends yet"
          description="Add a friend first to propose a manual obligation with them."
        />
      ) : (
        <>
          <ThemedText type="label" themeColor="textSecondary">
            Who
          </ThemedText>
          {friends.map(({ profile }) => (
            <Button
              key={profile.id}
              variant={selectedFriendId === profile.id ? 'accent' : 'muted'}
              onPress={() => setSelectedFriendId(profile.id)}
            >
              {profile.display_name}
            </Button>
          ))}

          <ThemedText type="label" themeColor="textSecondary">
            Direction
          </ThemedText>
          <Button variant={iOwe ? 'accent' : 'muted'} onPress={() => setIOwe(true)}>
            I owe them
          </Button>
          <Button variant={!iOwe ? 'accent' : 'muted'} onPress={() => setIOwe(false)}>
            They owe me
          </Button>

          <ThemedText type="label" themeColor="textSecondary">
            Currency
          </ThemedText>
          {currencies.map((currency) => (
            <Button
              key={currency.id}
              variant={currencyId === currency.id ? 'accent' : 'muted'}
              onPress={() => setSelectedCurrencyId(currency.id)}
            >
              {currency.icon ? `${currency.icon} ` : ''}
              {currency.name}
            </Button>
          ))}

          <TextField
            label="Amount"
            placeholder="e.g. 1"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          <TextField
            label="What for"
            placeholder="e.g. Gas money"
            value={description}
            onChangeText={setDescription}
          />

          <Button variant="primary" onPress={handlePropose} disabled={!canPropose}>
            Propose
          </Button>
        </>
      )}

      <InlineError message={error} />

      {incoming.length > 0 ? (
        <>
          <SectionHeader title="Awaiting your response" />
          {incoming.map(({ proposal, counterparty, currency, iAmDebtor }) => (
            <ListRow
              key={proposal.id}
              leading={
                counterparty ? (
                  <Avatar id={counterparty.id} name={counterparty.display_name} />
                ) : undefined
              }
              title={
                iAmDebtor
                  ? `You owe ${counterparty?.display_name ?? 'them'}`
                  : `${counterparty?.display_name ?? 'They'} owe(s) you`
              }
              subtitle={proposal.description}
              trailing={
                <>
                  {currency ? (
                    <CurrencyLabel quantity={proposal.amount} currency={currency} />
                  ) : null}
                  <Button
                    variant="primary"
                    onPress={() => runAction(approve.mutateAsync(proposal.id))}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="muted"
                    onPress={() => runAction(decline.mutateAsync(proposal.id))}
                  >
                    Decline
                  </Button>
                </>
              }
            />
          ))}
        </>
      ) : null}

      {outgoing.length > 0 ? (
        <>
          <SectionHeader title="Waiting on them" />
          {outgoing.map(({ proposal, counterparty, currency, iAmDebtor }) => (
            <ListRow
              key={proposal.id}
              leading={
                counterparty ? (
                  <Avatar id={counterparty.id} name={counterparty.display_name} />
                ) : undefined
              }
              title={
                iAmDebtor
                  ? `You owe ${counterparty?.display_name ?? 'them'}`
                  : `${counterparty?.display_name ?? 'They'} owe(s) you`
              }
              subtitle={proposal.description}
              trailing={
                <>
                  {currency ? (
                    <CurrencyLabel quantity={proposal.amount} currency={currency} />
                  ) : null}
                  <Button variant="muted" onPress={() => setCancelTargetId(proposal.id)}>
                    Cancel
                  </Button>
                </>
              }
            />
          ))}
        </>
      ) : null}

      <SectionHeader title="History" />
      {resolved.length === 0 ? (
        <EmptyState
          icon="obligations"
          title="Nothing resolved yet"
          description="Approved, declined, and cancelled obligations will show up here."
        />
      ) : (
        resolved.map(({ proposal, counterparty, currency, iAmDebtor }) => (
          <ListRow
            key={proposal.id}
            leading={
              counterparty ? (
                <Avatar id={counterparty.id} name={counterparty.display_name} />
              ) : undefined
            }
            title={
              iAmDebtor
                ? `You owe ${counterparty?.display_name ?? 'them'}`
                : `${counterparty?.display_name ?? 'They'} owe(s) you`
            }
            subtitle={proposal.description}
            trailing={
              <>
                {currency ? <CurrencyLabel quantity={proposal.amount} currency={currency} /> : null}
                <StatusBadge
                  label={proposal.status[0].toUpperCase() + proposal.status.slice(1)}
                  variant={STATUS_VARIANT[proposal.status]}
                />
              </>
            }
          />
        ))
      )}

      <ConfirmationDialog
        visible={cancelTargetId !== null}
        title="Cancel this proposal?"
        description="The other person will no longer be able to approve it."
        confirmLabel="Cancel proposal"
        destructive
        onConfirm={() => {
          if (cancelTargetId) runAction(cancel.mutateAsync(cancelTargetId));
          setCancelTargetId(null);
        }}
        onCancel={() => setCancelTargetId(null)}
      />
    </Screen>
  );
}
