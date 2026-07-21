import type { ReactNode } from 'react';

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`flex w-full items-center gap-three rounded-medium bg-surface p-three text-left shadow-card ${onClick ? 'cursor-pointer' : ''}`}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-bold">{title}</p>
        {subtitle ? <p className="truncate text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-two">{trailing}</div> : null}
    </Wrapper>
  );
}
