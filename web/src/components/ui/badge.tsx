export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  neutral: 'bg-neutral-bg text-neutral',
};

export function StatusBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-two py-half font-display text-xs font-bold whitespace-nowrap ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  );
}
