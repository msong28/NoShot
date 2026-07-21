export function ConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-four">
      <div className="w-full max-w-app rounded-large bg-surface p-four shadow-card">
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        {description ? <p className="mt-two text-sm text-text-secondary">{description}</p> : null}
        <div className="mt-four flex justify-end gap-two">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill px-three py-two font-display font-bold text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-pill px-three py-two font-display font-bold text-white ${destructive ? 'bg-danger' : 'bg-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
