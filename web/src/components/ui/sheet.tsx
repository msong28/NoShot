import type { ReactNode } from 'react';

import { Icons } from '@/lib/icons';

/**
 * Same bottom-sheet chrome as ConfirmationDialog (backdrop, grab handle) but
 * for a scrollable picker list instead of a confirm/cancel prompt, and full
 * viewport height rather than a partial sheet -- it slides up from the
 * bottom and covers the whole screen, since a picker list (recent bets,
 * currencies) wants all the room it can get rather than a peek-height
 * sheet. Shared by the create-bet-details recent-bets and currency pickers
 * so the chrome isn't duplicated twice.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(20,15,10,0.55)' }}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-app flex-col rounded-t-sheet bg-surface p-four pb-six"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-four h-1 w-10 shrink-0 rounded-pill bg-line" />

        <div className="mb-two flex shrink-0 items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-pill bg-surface-sunken text-text-secondary"
          >
            <Icons.close size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-two overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
