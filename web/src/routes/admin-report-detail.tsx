import { useState } from 'react';
import { useParams } from 'react-router';
import { BackButton } from '@/components/ui/back-button';

import { StatusBadge, type BadgeVariant } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { SectionHeader } from '@/components/ui/section-header';
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

function statusVariant(status: string): BadgeVariant {
  if (status === 'open') return 'warning';
  if (status === 'resolved') return 'success';
  return 'neutral';
}

export function AdminReportDetailScreen() {
  const { reportId } = useParams<{ reportId: string }>();
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
      <main className="mx-auto max-w-app p-four pb-16">
        <BackButton />
        <p className="mt-four text-text-secondary">Loading…</p>
      </main>
    );
  }

  const r = report.data;
  const canRemoveContent = CONTENT_TARGET_TYPES.has(r.target_type);
  const canAct = r.status === 'open';

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <h1 className="mt-three font-display text-2xl font-extrabold">
        {r.target_type.replace('_', ' ')} report
      </h1>
      <div className="mt-two">
        <StatusBadge label={r.status} variant={statusVariant(r.status)} />
      </div>
      <p className="mt-two text-sm text-text-secondary">Reason: {REPORT_REASON_LABELS[r.reason]}</p>
      {r.details ? <p className="mt-two text-sm">{r.details}</p> : null}
      <p className="mt-two text-xs text-text-faint">
        Reported {new Date(r.created_at).toLocaleString()}
      </p>

      <SectionHeader title="Evidence" />
      {evidence.isLoading ? (
        <p className="mt-two text-sm text-text-secondary">Loading…</p>
      ) : evidence.isError ? (
        <InlineError message={getErrorMessage(evidence.error, 'Could not load evidence')} />
      ) : (
        <div className="mt-two rounded-large bg-surface p-three shadow-card">
          {Object.entries(evidence.data ?? {}).map(([key, value]) => (
            <p key={key} className="text-sm text-text-secondary">
              {key}: {String(value)}
            </p>
          ))}
        </div>
      )}

      {canAct ? (
        <>
          <SectionHeader title="Actions" />
          <div className="mt-two flex flex-col gap-two">
            <label className="text-sm text-text-secondary">Note (optional)</label>
            <input
              placeholder="Context for the audit log"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-medium bg-surface p-three shadow-card"
            />
          </div>
          <div className="mt-two">
            <InlineError message={error} />
          </div>
          <div className="mt-three flex flex-wrap gap-two">
            {canRemoveContent ? (
              <button
                type="button"
                onClick={() => setPendingAction('remove_content')}
                className="rounded-pill bg-danger px-three py-two font-display font-bold text-white"
              >
                Remove content
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPendingAction('suspend_user')}
              className="rounded-pill bg-danger px-three py-two font-display font-bold text-white"
            >
              Suspend user
            </button>
            <button
              type="button"
              onClick={() => setPendingAction('resolve')}
              className="rounded-pill bg-primary px-three py-two font-display font-bold text-on-primary"
            >
              Resolve
            </button>
            <button
              type="button"
              onClick={() => setPendingAction('dismiss')}
              className="rounded-pill bg-surface-sunken px-three py-two font-display font-bold text-text-secondary"
            >
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <p className="mt-four text-sm text-text-secondary">This report is already {r.status}.</p>
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
    </main>
  );
}
