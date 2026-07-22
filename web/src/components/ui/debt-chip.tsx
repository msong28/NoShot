/**
 * README §"Debt chip": direction must never be ambiguous -- always an
 * arrow + a color + a label together, never color alone. `up` = they owe
 * you / leading, `down` = you owe.
 */
export function DebtChip({ direction, label }: { direction: 'up' | 'down'; label: string }) {
  const classes = direction === 'up' ? 'bg-up-soft text-up-ink' : 'bg-down-soft text-down-ink';
  const arrow = direction === 'up' ? '↑' : '↓';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-pill px-two py-half text-eyebrow font-bold whitespace-nowrap ${classes}`}
    >
      {arrow} {label}
    </span>
  );
}
