/**
 * Sentence-case bold section title (README's "section heading" type role,
 * 15-16px/700) -- not to be confused with `Eyebrow`, the mono uppercase
 * label used for things like "YOUR STANDING" inside cards. `count` is a
 * plain muted trailing number ("Your friends" · 6); `badge` is the filled
 * grape-soft pill used for attention counts ("Requests" · [1]).
 */
export function SectionHeader({
  title,
  count,
  badge,
}: {
  title: string;
  count?: number | string;
  badge?: number | string;
}) {
  return (
    <div className="mt-four flex items-center gap-two">
      <h2 className="font-display text-section font-bold">{title}</h2>
      {badge !== undefined ? (
        <span className="rounded-pill bg-grape-soft px-two py-half text-xs font-bold text-grape-ink">
          {badge}
        </span>
      ) : null}
      {count !== undefined ? (
        <span className="ml-auto text-sm text-text-secondary">{count}</span>
      ) : null}
    </div>
  );
}
