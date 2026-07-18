import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { useApproveBetVersion, useBetDetail } from '@/hooks/use-bets';
import { useSession } from '@/hooks/use-session';
import { ResolutionMethods, computePayoutPreview, type BetApprovalDecision } from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';

export default function BetDetailScreen() {
  const { betId } = useLocalSearchParams<{ betId: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { bet, sides, roster, isLoading } = useBetDetail(betId);
  const approveBetVersion = useApproveBetVersion(betId, userId);

  const [error, setError] = useState<string | null>(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const me = roster.find((row) => row.participant.user_id === userId);
  const myApproval = me?.approval;
  const canRespond = bet && ['pending_acceptance', 'active'].includes(bet.status) && !myApproval;

  const payoutPreview = useMemo(() => {
    const sideDrafts = sides.map((s) => ({ outcomeKey: s.outcome_key, label: s.label }));
    const participantDrafts = roster
      .filter((row) => row.commitment && row.side)
      .map((row) => ({
        userId: row.participant.user_id,
        outcomeKey: row.side!.outcome_key,
        currencyId: row.commitment!.currency_id,
        stakeQuantity: row.commitment!.stake_quantity,
        oddsNumerator: row.commitment!.odds_numerator,
        oddsDenominator: row.commitment!.odds_denominator,
      }));
    return participantDrafts.length > 0 ? computePayoutPreview(sideDrafts, participantDrafts) : [];
  }, [sides, roster]);

  function respond(decision: BetApprovalDecision) {
    if (!bet) return;
    setError(null);
    approveBetVersion.mutate(
      { versionNo: bet.current_version, decision },
      { onError: (err) => setError(getErrorMessage(err, 'Something went wrong')) },
    );
  }

  if (isLoading || !bet) {
    return (
      <Screen>
        <Button variant="muted" onPress={() => router.back()}>
          Back
        </Button>
      </Screen>
    );
  }

  const statusVariant =
    bet.status === 'active' ? 'success' : bet.status === 'voided' ? 'danger' : 'warning';

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">{bet.title}</ThemedText>
      <StatusBadge label={bet.status.replace('_', ' ')} variant={statusVariant} />
      {bet.description ? (
        <ThemedText type="body" themeColor="textSecondary">
          {bet.description}
        </ThemedText>
      ) : null}
      <ThemedText type="bodySM" themeColor="textMuted">
        Resolved by: {ResolutionMethods.find((m) => m.value === bet.resolution_method)?.label}
      </ThemedText>

      <SectionHeader title="Participants" />
      {roster.map((row) => (
        <ListRow
          key={row.participant.id}
          leading={
            row.profile ? <Avatar id={row.profile.id} name={row.profile.display_name} /> : undefined
          }
          title={row.profile?.display_name ?? 'Unknown'}
          subtitle={row.side?.label}
          trailing={
            row.approval ? (
              <StatusBadge
                label={row.approval.decision === 'approved' ? 'Approved' : 'Declined'}
                variant={row.approval.decision === 'approved' ? 'success' : 'danger'}
              />
            ) : (
              <StatusBadge label="Pending" variant="warning" />
            )
          }
        />
      ))}

      {payoutPreview.length > 0 ? (
        <>
          <SectionHeader title="Payout preview" />
          <Card>
            {sides.map((side) => (
              <ThemedText key={side.outcome_key} type="bodySM" themeColor="textSecondary">
                If {side.label}:{' '}
                {payoutPreview
                  .filter((row) => row.outcomeKey === side.outcome_key)
                  .map((row) => {
                    const name = roster.find((r) => r.participant.user_id === row.userId)?.profile
                      ?.display_name;
                    return row.amount >= 0
                      ? `${name} receives ${row.amount}`
                      : `${name} owes ${Math.abs(row.amount)}`;
                  })
                  .join(', ')}
              </ThemedText>
            ))}
          </Card>
        </>
      ) : null}

      <InlineError message={error} />

      {canRespond ? (
        <>
          <Button
            variant="primary"
            onPress={() => respond('approved')}
            disabled={approveBetVersion.isPending}
          >
            Approve
          </Button>
          <Button variant="muted" onPress={() => setShowDeclineConfirm(true)}>
            Decline
          </Button>
        </>
      ) : null}

      <ConfirmationDialog
        visible={showDeclineConfirm}
        title="Decline this bet?"
        description="This voids the proposal for everyone -- it can't be undone."
        confirmLabel="Decline"
        destructive
        onConfirm={() => {
          setShowDeclineConfirm(false);
          respond('declined');
        }}
        onCancel={() => setShowDeclineConfirm(false)}
      />
    </Screen>
  );
}
