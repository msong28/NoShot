import { AnimatePresence, motion } from 'motion/react';

export type SheetAction = {
  label: string;
  onSelect: () => void;
  /** Danger styling for irreversible / serious actions. */
  destructive?: boolean;
};

/**
 * Compact bottom sheet of actions, opened from a "⋯" button -- the usual home
 * for secondary and risky actions (report, unfriend, block) so they're never
 * sitting on the screen waiting for a stray tap. Choosing a risky action
 * should lead to a confirmation, not perform it directly.
 */
export function ActionSheet({
  visible,
  actions,
  onClose,
}: {
  visible: boolean;
  actions: SheetAction[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(20,15,10,0.55)' }}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            role="menu"
            className="w-full max-w-app rounded-t-sheet bg-surface p-four pb-six"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="mx-auto mb-three h-1 w-10 rounded-pill bg-line" />
            <div className="flex flex-col divide-y divide-line">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  onClick={action.onSelect}
                  className={`py-three text-left text-base font-bold ${
                    action.destructive ? 'text-danger-ink' : 'text-ink'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-three w-full rounded-[16px] bg-surface-sunken py-three text-sm font-bold"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
