import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import {
  useApproveBetVersion,
  useApproveCancelBet,
  useBetDetail,
  useConfirmBetResult,
  useProposeCancelBet,
  useResolveDispute,
  useSubmitBetResult,
  useTriggerRandomFallback,
  useVoteOnDispute,
} from '@/hooks/use-bets';
import { useSession } from '@/hooks/use-session';
import {
  ResolutionMethods,
  TIE_OUTCOME_KEY,
  computePayoutPreview,
  type BetApprovalDecision,
} from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';

const RESULT_ELIGIBLE_STATUSES = ['active', 'pending_result', 'disputed', 'resolved', 'tied'];

export default function BetDetailScreen() {
  const { betId } = useLocalSearchParams<{ betId: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    bet,
    sides,
    roster,
    participantProfiles,
    cancellationApprovals,
    resultSubmissions,
    resultConfirmations,
    disputeVotes,
    disputeResolution,
    isLoading,
  } = useBetDetail(betId);
  const approveBetVersion = useApproveBetVersion(betId, userId);
  const proposeCancelBet = useProposeCancelBet(betId, userId);
  const approveCancelBet = useApproveCancelBet(betId, userId);
  const submitBetResult = useSubmitBetResult(betId, userId);
  const confirmBetResult = useConfirmBetResult(betId, userId);
  const resolveDispute = useResolveDispute(betId, userId);
  const voteOnDispute = useVoteOnDispute(betId, userId);
  const triggerRandomFallback = useTriggerRandomFallback(betId, userId);

  const [error, setError] = useState<string | null>(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showKeepConfirm, setShowKeepConfirm] = useState(false);
  const [showRandomFallbackConfirm, setShowRandomFallbackConfirm] = useState(false);
  const [submitOutcomeKey, setSubmitOutcomeKey] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [judgeOutcomeKey, setJudgeOutcomeKey] = useState<string | null>(null);
  const [voteOutcomeKey, setVoteOutcomeKey] = useState<string | null>(null);

  const me = roster.find((row) => row.participant.user_id === userId);
  const myApproval = me?.approval;
  const canRespond = bet && bet.status === 'pending_acceptance' && !myApproval;

  const myCancellationResponse = cancellationApprovals.find((a) => a.user_id === userId);
  const canProposeCancel = bet && bet.status === 'active' && !!me;
  const canRespondToCancel =
    bet && bet.status === 'cancellation_pending' && !myCancellationResponse;

  const canSubmitResult =
    bet &&
    ['active', 'pending_result', 'disputed'].includes(bet.status) &&
    (bet.resolution_method === 'judge' ? userId === bet.judge_id : !!me);

  const isJudgeForThisBet = bet?.resolution_method === 'judge' && userId === bet.judge_id;
  const canResolveAsJudge = bet && bet.status === 'disputed' && isJudgeForThisBet;

  const myVote = disputeVotes.find((v) => v.voter_id === userId);
  const canVote =
    bet && bet.status === 'disputed' && bet.resolution_method === 'group_vote' && !myVote;

  const canTriggerRandomFallback =
    bet && bet.status === 'disputed' && bet.random_fallback_enabled && !!me;

  const voteTally = useMemo(() => {
    const tally = new Map<string, number>();
    for (const vote of disputeVotes) {
      tally.set(vote.outcome_key, (tally.get(vote.outcome_key) ?? 0) + 1);
    }
    return tally;
  }, [disputeVotes]);

  function outcomeLabel(outcomeKey: string): string {
    if (outcomeKey === TIE_OUTCOME_KEY) return 'Tie';
    return sides.find((s) => s.outcome_key === outcomeKey)?.label ?? outcomeKey;
  }

  function nameFor(id: string): string {
    return (
      roster.find((r) => r.participant.user_id === id)?.profile?.display_name ??
      participantProfiles.find((p) => p.id === id)?.display_name ??
      'Someone'
    );
  }

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

  function proposeCancel() {
    setError(null);
    proposeCancelBet.mutate(undefined, {
      onError: (err) => setError(getErrorMessage(err, 'Something went wrong')),
    });
  }

  function respondToCancel(decision: BetApprovalDecision) {
    setError(null);
    approveCancelBet.mutate(decision, {
      onError: (err) => setError(getErrorMessage(err, 'Something went wrong')),
    });
  }

  function submitResult() {
    if (!submitOutcomeKey) return;
    setError(null);
    submitBetResult.mutate(
      { outcomeKey: submitOutcomeKey, rationale: rationale.trim() || undefined },
      {
        onSuccess: () => {
          setSubmitOutcomeKey(null);
          setRationale('');
        },
        onError: (err) => setError(getErrorMessage(err, 'Something went wrong')),
      },
    );
  }

  function confirmResult(resultSubmissionId: string, decision: BetApprovalDecision) {
    setError(null);
    confirmBetResult.mutate(
      { resultSubmissionId, decision },
      { onError: (err) => setError(getErrorMessage(err, 'Something went wrong')) },
    );
  }

  function resolveAsJudge() {
    if (!judgeOutcomeKey) return;
    setError(null);
    resolveDispute.mutate(judgeOutcomeKey, {
      onSuccess: () => setJudgeOutcomeKey(null),
      onError: (err) => setError(getErrorMessage(err, 'Something went wrong')),
    });
  }

  function castVote() {
    if (!voteOutcomeKey) return;
    setError(null);
    voteOnDispute.mutate(voteOutcomeKey, {
      onSuccess: () => setVoteOutcomeKey(null),
      onError: (err) => setError(getErrorMessage(err, 'Something went wrong')),
    });
  }

  function triggerRandom() {
    setError(null);
    triggerRandomFallback.mutate(undefined, {
      onError: (err) => setError(getErrorMessage(err, 'Something went wrong')),
    });
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
    bet.status === 'active' || bet.status === 'resolved'
      ? 'success'
      : bet.status === 'voided'
        ? 'danger'
        : bet.status === 'tied'
          ? 'neutral'
          : 'warning';

  const outcomeOptions = [...sides.map((s) => s.outcome_key), TIE_OUTCOME_KEY];

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

      {bet.status === 'cancellation_pending' ? (
        <>
          <SectionHeader title="Cancellation" />
          {roster.map((row) => {
            const response = cancellationApprovals.find(
              (a) => a.user_id === row.participant.user_id,
            );
            return (
              <ListRow
                key={row.participant.id}
                leading={
                  row.profile ? (
                    <Avatar id={row.profile.id} name={row.profile.display_name} />
                  ) : undefined
                }
                title={row.profile?.display_name ?? 'Unknown'}
                trailing={
                  response ? (
                    <StatusBadge
                      label={response.decision === 'approved' ? 'Wants to cancel' : 'Declined'}
                      variant={response.decision === 'approved' ? 'warning' : 'danger'}
                    />
                  ) : (
                    <StatusBadge label="Pending" variant="warning" />
                  )
                }
              />
            );
          })}
        </>
      ) : null}

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

      {RESULT_ELIGIBLE_STATUSES.includes(bet.status) ? (
        <>
          <SectionHeader title="Result" />

          {bet.status === 'resolved' || bet.status === 'tied' ? (
            <Card>
              <ThemedText type="label">
                {bet.status === 'tied'
                  ? 'Tied -- no obligations'
                  : outcomeLabel(bet.resolved_outcome_key ?? '')}
              </ThemedText>
              {disputeResolution ? (
                <ThemedText type="bodySM" themeColor="textSecondary">
                  Resolved by{' '}
                  {disputeResolution.judge_or_vote_snapshot_json &&
                  'random_fallback' in disputeResolution.judge_or_vote_snapshot_json
                    ? 'random fallback'
                    : disputeResolution.resolution_method === 'judge'
                      ? "the judge's decision"
                      : 'a group vote'}
                  .
                </ThemedText>
              ) : null}
            </Card>
          ) : null}

          {resultSubmissions.map((submission) => {
            const myConfirmation = resultConfirmations.find(
              (c) => c.result_submission_id === submission.id && c.user_id === userId,
            );
            const confirmedCount = resultConfirmations.filter(
              (c) => c.result_submission_id === submission.id && c.decision === 'approved',
            ).length;
            return (
              <ListRow
                key={submission.id}
                title={`${nameFor(submission.submitter_id)} says: ${outcomeLabel(submission.proposed_outcome_key)}`}
                subtitle={submission.rationale ?? undefined}
                trailing={
                  !me || myConfirmation ? (
                    <StatusBadge
                      label={`${confirmedCount}/${roster.length} confirmed`}
                      variant="info"
                    />
                  ) : (
                    <Button
                      variant="primary"
                      onPress={() => confirmResult(submission.id, 'approved')}
                      disabled={confirmBetResult.isPending}
                    >
                      Confirm
                    </Button>
                  )
                }
              />
            );
          })}

          {bet.status === 'disputed' && bet.resolution_method === 'group_vote' ? (
            <Card style={styles.voteCard}>
              <ThemedText type="label">Votes</ThemedText>
              {outcomeOptions
                .filter((key) => voteTally.get(key))
                .map((key) => (
                  <ThemedText key={key} type="bodySM" themeColor="textSecondary">
                    {outcomeLabel(key)}: {voteTally.get(key)}
                  </ThemedText>
                ))}
            </Card>
          ) : null}

          {canSubmitResult ? (
            <Card style={styles.submitCard}>
              <ThemedText type="label">Submit a result</ThemedText>
              <View style={styles.pillRow}>
                {outcomeOptions.map((key) => (
                  <Button
                    key={key}
                    variant={submitOutcomeKey === key ? 'accent' : 'muted'}
                    onPress={() => setSubmitOutcomeKey(key)}
                  >
                    {outcomeLabel(key)}
                  </Button>
                ))}
              </View>
              <TextField
                label="Rationale (optional)"
                placeholder="Any context worth adding"
                value={rationale}
                onChangeText={setRationale}
              />
              <Button
                variant="primary"
                onPress={submitResult}
                disabled={!submitOutcomeKey || submitBetResult.isPending}
              >
                Submit result
              </Button>
            </Card>
          ) : null}

          {canResolveAsJudge ? (
            <Card style={styles.submitCard}>
              <ThemedText type="label">Resolve as judge</ThemedText>
              <View style={styles.pillRow}>
                {outcomeOptions.map((key) => (
                  <Button
                    key={key}
                    variant={judgeOutcomeKey === key ? 'accent' : 'muted'}
                    onPress={() => setJudgeOutcomeKey(key)}
                  >
                    {outcomeLabel(key)}
                  </Button>
                ))}
              </View>
              <Button
                variant="primary"
                onPress={resolveAsJudge}
                disabled={!judgeOutcomeKey || resolveDispute.isPending}
              >
                Resolve dispute
              </Button>
            </Card>
          ) : null}

          {canVote ? (
            <Card style={styles.submitCard}>
              <ThemedText type="label">Cast your vote</ThemedText>
              <View style={styles.pillRow}>
                {outcomeOptions.map((key) => (
                  <Button
                    key={key}
                    variant={voteOutcomeKey === key ? 'accent' : 'muted'}
                    onPress={() => setVoteOutcomeKey(key)}
                  >
                    {outcomeLabel(key)}
                  </Button>
                ))}
              </View>
              <Button
                variant="primary"
                onPress={castVote}
                disabled={!voteOutcomeKey || voteOnDispute.isPending}
              >
                Vote
              </Button>
            </Card>
          ) : null}

          {canTriggerRandomFallback ? (
            <Button variant="muted" onPress={() => setShowRandomFallbackConfirm(true)}>
              Trigger random fallback
            </Button>
          ) : null}
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

      {canProposeCancel ? (
        <Button variant="muted" onPress={() => setShowCancelConfirm(true)}>
          Cancel bet
        </Button>
      ) : null}

      {canRespondToCancel ? (
        <>
          <Button
            variant="muted"
            onPress={() => respondToCancel('approved')}
            disabled={approveCancelBet.isPending}
          >
            Confirm cancellation
          </Button>
          <Button variant="primary" onPress={() => setShowKeepConfirm(true)}>
            Keep this bet
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

      <ConfirmationDialog
        visible={showCancelConfirm}
        title="Propose cancelling this bet?"
        description="Everyone involved needs to agree before it's actually cancelled."
        confirmLabel="Propose cancellation"
        destructive
        onConfirm={() => {
          setShowCancelConfirm(false);
          proposeCancel();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />

      <ConfirmationDialog
        visible={showKeepConfirm}
        title="Keep this bet active?"
        description="This rejects the cancellation -- the bet continues exactly as it was."
        confirmLabel="Keep it"
        onConfirm={() => {
          setShowKeepConfirm(false);
          respondToCancel('declined');
        }}
        onCancel={() => setShowKeepConfirm(false)}
      />

      <ConfirmationDialog
        visible={showRandomFallbackConfirm}
        title="Trigger the random fallback?"
        description="This randomly picks among the outcomes people have actually submitted, and finalizes the bet immediately -- it can't be undone."
        confirmLabel="Trigger it"
        destructive
        onConfirm={() => {
          setShowRandomFallbackConfirm(false);
          triggerRandom();
        }}
        onCancel={() => setShowRandomFallbackConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  submitCard: {
    gap: Spacing.two,
  },
  voteCard: {
    gap: Spacing.half,
  },
});
