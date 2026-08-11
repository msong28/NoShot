import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import {
  useDismissReport,
  useRemoveContent,
  useReportDetail,
  useReportEvidence,
  useResolveReport,
  useSuspendUser,
} from '@/hooks/use-admin';
import { getErrorMessage } from '@/lib/errors';
import { REPORT_REASON_LABELS } from '@/lib/report';

type PendingAction = 'remove_content' | 'suspend_user' | 'resolve' | 'dismiss' | null;

// The four target types that carry a moderation_status column -- see
// admin_remove_content()'s own case statement, which this mirrors so the
// button is never offered for a type the RPC would reject anyway.
const CONTENT_TARGET_TYPES = new Set(['comment', 'chat_message', 'proof_asset', 'currency']);

type AdminActionMutation = {
  mutateAsync: (input: { reportId: string; note?: string }) => Promise<unknown>;
};

export default function AdminReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const report = useReportDetail(reportId);
  const evidence = useReportEvidence(reportId);
  const removeContent = useRemoveContent();
  const suspendUser = useSuspendUser();
  const resolveReport = useResolveReport();
  const dismissReport = useDismissReport();

  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);

  function run(mutation: AdminActionMutation) {
    setError(null);
    mutation
      .mutateAsync({ reportId: reportId as string, note })
      .then(() => {
        setNote('');
        setPendingAction(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  if (report.isLoading || !report.data) {
    return (
      <Screen>
        <Button variant="muted" onPress={() => router.back()}>
          Back
        </Button>
      </Screen>
    );
  }

  const r = report.data;
  const canRemoveContent = CONTENT_TARGET_TYPES.has(r.target_type);
  const canAct = r.status === 'open';
  const statusVariant =
    r.status === 'open' ? 'warning' : r.status === 'resolved' ? 'success' : 'neutral';

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">{r.target_type.replace('_', ' ')} report</ThemedText>
      <StatusBadge label={r.status} variant={statusVariant} />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Reason: {REPORT_REASON_LABELS[r.reason]}
      </ThemedText>
      {r.details ? <ThemedText type="bodySM">{r.details}</ThemedText> : null}
      <ThemedText type="small" themeColor="textMuted">
        Reported {new Date(r.created_at).toLocaleString()}
      </ThemedText>

      <SectionHeader title="Evidence" />
      {evidence.isLoading ? (
        <ThemedText type="bodySM" themeColor="textMuted">
          Loading…
        </ThemedText>
      ) : evidence.isError ? (
        <InlineError message={getErrorMessage(evidence.error, 'Could not load evidence')} />
      ) : (
        <Card>
          {Object.entries(evidence.data ?? {}).map(([key, value]) => (
            <ThemedText key={key} type="bodySM" themeColor="textSecondary">
              {key}: {String(value)}
            </ThemedText>
          ))}
        </Card>
      )}

      {canAct ? (
        <>
          <SectionHeader title="Actions" />
          <TextField
            label="Note (optional)"
            placeholder="Context for the audit log"
            value={note}
            onChangeText={setNote}
          />
          <InlineError message={error} />
          <View style={styles.actions}>
            {canRemoveContent ? (
              <Button variant="destructive" onPress={() => setPendingAction('remove_content')}>
                Remove content
              </Button>
            ) : null}
            <Button variant="destructive" onPress={() => setPendingAction('suspend_user')}>
              Suspend user
            </Button>
            <Button variant="primary" onPress={() => setPendingAction('resolve')}>
              Resolve
            </Button>
            <Button variant="muted" onPress={() => setPendingAction('dismiss')}>
              Dismiss
            </Button>
          </View>
        </>
      ) : (
        <ThemedText type="bodySM" themeColor="textMuted">
          This report is already {r.status}.
        </ThemedText>
      )}

      <ConfirmationDialog
        visible={pendingAction === 'remove_content'}
        title="Remove this content?"
        description="Marks it blocked and hidden -- this is logged permanently."
        confirmLabel="Remove"
        destructive
        onConfirm={() => run(removeContent)}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmationDialog
        visible={pendingAction === 'suspend_user'}
        title="Suspend the responsible user?"
        description="This is logged permanently. It does not yet block their access anywhere else in the app."
        confirmLabel="Suspend"
        destructive
        onConfirm={() => run(suspendUser)}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmationDialog
        visible={pendingAction === 'resolve'}
        title="Resolve this report?"
        confirmLabel="Resolve"
        onConfirm={() => run(resolveReport)}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmationDialog
        visible={pendingAction === 'dismiss'}
        title="Dismiss this report?"
        confirmLabel="Dismiss"
        onConfirm={() => run(dismissReport)}
        onCancel={() => setPendingAction(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
