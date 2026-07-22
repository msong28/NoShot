import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

/**
 * README §"4e Cancel confirm" -- "the one serious screen; no mascot (rule)".
 * A shared bottom sheet used for every irreversible confirmation in the app
 * (cancel bet, leave/archive group, cancel a manual obligation, admin
 * remove-content/suspend), not just bet cancellation -- the README's own
 * Buttons section groups "Delete account" and "Yes, cancel bet" under the
 * same irreversible-solid pattern. Dimmed, blurred backdrop; a grab handle;
 * a warning tile; and danger-register buttons only when the action is
 * actually destructive (`destructive` unset keeps the routine grape
 * primary, e.g. "Resolve this report?").
 */
export function ConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Defaults to "Cancel" (unchanged for the other call sites); the bet-
   * cancel sheet overrides it to "Keep it" to match the mock exactly. */
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional preview of the specific item being acted on, e.g. the
   * affected bet's row -- rendered between the description and buttons. */
  children?: ReactNode;
}) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(20,15,10,0.55)' }}
    >
      <div className="w-full max-w-app rounded-t-sheet bg-surface p-four pb-six">
        <div className="mx-auto mb-four h-1 w-10 rounded-pill bg-line" />

        <div className="flex flex-col items-center text-center">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-medium text-2xl ${
              destructive ? 'bg-danger-soft' : 'bg-grape-soft'
            }`}
          >
            ⚠️
          </span>
          <h2 className="mt-three font-display text-lg font-extrabold">{title}</h2>
          {description ? <p className="mt-two text-sm text-text-secondary">{description}</p> : null}
        </div>

        {children ? <div className="mt-three">{children}</div> : null}

        <div className="mt-four flex flex-col gap-two">
          <Button variant={destructive ? 'dangerSolid' : 'primary'} fullWidth onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
