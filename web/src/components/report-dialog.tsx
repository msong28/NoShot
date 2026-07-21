import { useState } from 'react';

import { InlineError } from '@/components/ui/inline-error';
import { useSubmitReport } from '@/hooks/use-reports';
import { getErrorMessage } from '@/lib/errors';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/report';

/** MOD-01's "Report" action -- one reusable dialog wired into every
 * reportable surface (bets, currencies, comments, chat messages, proof
 * images, user profiles), rather than six bespoke ones. */
export function ReportDialog({
  visible,
  targetType,
  targetId,
  onClose,
}: {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string | null;
  onClose: () => void;
}) {
  const submitReport = useSubmitReport();
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');

  if (!visible) return null;

  function handleClose() {
    setReason('harassment');
    setDetails('');
    submitReport.reset();
    onClose();
  }

  function handleSubmit() {
    if (!targetId) return;
    submitReport.mutate(
      { targetType, targetId, reason, details },
      { onSuccess: handleClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-four">
      <div className="w-full max-w-app rounded-large bg-surface p-four shadow-card">
        <h2 className="font-display text-lg font-extrabold">Report this</h2>
        <div className="mt-three flex flex-col gap-one">
          {REPORT_REASONS.map((option) => {
            const selected = option === reason;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className={`rounded-medium border p-two text-left text-sm ${
                  selected ? 'border-secondary bg-surface-sunken' : 'border-border text-text-secondary'
                }`}
              >
                {REPORT_REASON_LABELS[option]}
              </button>
            );
          })}
        </div>
        <textarea
          placeholder="Details (optional) -- anything else we should know?"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="mt-three w-full rounded-medium bg-surface-sunken p-two text-sm"
          rows={3}
        />
        <InlineError
          message={submitReport.isError ? getErrorMessage(submitReport.error, 'Could not submit report') : null}
        />
        <div className="mt-four flex justify-end gap-two">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-pill px-three py-two font-display font-bold text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitReport.isPending}
            className="rounded-pill bg-danger px-three py-two font-display font-bold text-white disabled:opacity-60"
          >
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}
