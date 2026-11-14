import type { ReactNode } from 'react';
import { Link } from 'react-router';

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
  to,
  borderColorClassName = 'border-line',
  className = '',
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  /** Makes the whole row a link. Don't put other buttons/links in `trailing`. */
  to?: string;
  /** Border color override, e.g. `border-danger` for a disputed row. A
   * dedicated prop (rather than folding into `className`) so it reliably
   * replaces the default instead of relying on Tailwind's utility-conflict
   * ordering between two `border-*-color` classes. */
  borderColorClassName?: string;
  className?: string;
}) {
  const classes = `flex w-full items-center gap-three rounded-medium border bg-surface p-[13px] text-left ${borderColorClassName} ${onClick || to ? 'cursor-pointer' : ''} ${className}`;
  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-row-title font-bold">{title}</p>
        {subtitle ? <p className="truncate text-subline text-text-secondary">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-two">{trailing}</div> : null}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper onClick={onClick} type={onClick ? 'button' : undefined} className={classes}>
      {content}
    </Wrapper>
  );
}
