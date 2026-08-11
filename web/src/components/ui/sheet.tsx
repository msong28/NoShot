import type { ReactNode } from 'react';

import { AnimatePresence, motion } from 'motion/react';

import { Icons } from '@/lib/icons';

/**
 * Same bottom-sheet chrome as ConfirmationDialog (backdrop, grab handle) but
 * for a scrollable picker list instead of a confirm/cancel prompt, and full
 * viewport height rather than a partial sheet -- it slides up from the
 * bottom and covers the whole screen, since a picker list (recent bets,
 * currencies) wants all the room it can get rather than a peek-height
 * sheet. Shared by the create-bet-details recent-bets and currency pickers
 * so the chrome isn't duplicated twice. Wrapped in AnimatePresence so the
 * slide-up/fade actually plays on the way in *and* out -- a plain
 * `visible ? … : null` can only animate the mount, not the unmount.
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
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-50 flex justify-center backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(20,15,10,0.55)' }}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="flex h-full w-full max-w-app flex-col rounded-t-sheet bg-surface p-four pb-six"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
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
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
