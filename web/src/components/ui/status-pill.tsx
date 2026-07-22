/**
 * The bet-lifecycle status pill -- README §"Status pill": five states, each
 * a soft background + ink text + a small dot of the same hue, plus `lost`
 * (not in the README's formal 5-state list, but shown distinctly from `won`
 * on the Profile screen's recent-bets list -- reusing the `down`/amber
 * palette, same hue debt chips use for "you owe", since a personal loss is
 * never the `won` green).
 */
export type StatusPillVariant = 'pending' | 'active' | 'disputed' | 'won' | 'lost' | 'tied';

const VARIANT_CLASSES: Record<StatusPillVariant, { pill: string; dot: string }> = {
  pending: { pill: 'bg-gold-soft text-gold-ink', dot: 'bg-gold' },
  active: { pill: 'bg-grape-soft text-grape-ink', dot: 'bg-grape' },
  disputed: { pill: 'bg-danger-soft text-danger-ink', dot: 'bg-danger' },
  won: { pill: 'bg-up-soft text-up-ink', dot: 'bg-up' },
  lost: { pill: 'bg-down-soft text-down-ink', dot: 'bg-down' },
  tied: { pill: 'bg-neutral-soft text-text-secondary', dot: 'bg-text-secondary' },
};

const DEFAULT_LABELS: Record<StatusPillVariant, string> = {
  pending: 'Pending',
  active: 'Active',
  disputed: 'Disputed',
  won: 'Won',
  lost: 'Lost',
  tied: 'Tied',
};

export function StatusPill({ variant, label }: { variant: StatusPillVariant; label?: string }) {
  const { pill, dot } = VARIANT_CLASSES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-two py-half text-eyebrow font-bold whitespace-nowrap ${pill}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-pill ${dot}`} />
      {label ?? DEFAULT_LABELS[variant]}
    </span>
  );
}
