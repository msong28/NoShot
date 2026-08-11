import type { ReactNode } from 'react';

/**
 * README §"List row (the atom)": surface bg, 1px line border, radius 18
 * (rounded-medium), 13px padding -- flat, no drop shadow (shadow-card is
 * reserved for elevated cards, not routine rows).
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  borderColorClassName = 'border-line',
  className = '',
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  /** Border color override, e.g. `border-danger` for a disputed row. A
   * dedicated prop (rather than folding into `className`) so it reliably
   * replaces the default instead of relying on Tailwind's utility-conflict
   * ordering between two `border-*-color` classes. */
  borderColorClassName?: string;
  className?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`flex w-full items-center gap-three rounded-medium border bg-surface p-[13px] text-left ${borderColorClassName} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-row-title font-bold">{title}</p>
        {subtitle ? <p className="truncate text-subline text-text-secondary">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-two">{trailing}</div> : null}
    </Wrapper>
  );
}
