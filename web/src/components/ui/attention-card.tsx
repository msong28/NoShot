import type { ReactNode } from 'react';

/**
 * README §"Needs attention / your move treatment" -- the app's only
 * notification surface. A grape (routine attention) or danger (dispute)
 * border + tinted shadow, an icon tile, an eyebrow label, a title/subtitle,
 * and an actions row (buttons or a single link).
 */
export function AttentionCard({
  variant,
  icon,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  variant: 'grape' | 'danger';
  icon: ReactNode;
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  const border = variant === 'grape' ? 'border-grape' : 'border-danger';
  const eyebrowColor = variant === 'grape' ? 'text-grape-ink' : 'text-danger-ink';

  return (
    <div
      className={`flex w-64 shrink-0 flex-col gap-two rounded-large border-[1.5px] bg-surface p-three shadow-attention ${border}`}
    >
      <div className="flex items-center gap-two">
        {icon}
        <p
          className={`font-mono text-eyebrow tracking-eyebrow font-bold uppercase ${eyebrowColor}`}
        >
          {eyebrow}
        </p>
      </div>
      <div>
        <p className="text-row-title font-bold">{title}</p>
        {subtitle ? <p className="mt-half text-subline text-text-secondary">{subtitle}</p> : null}
      </div>
      {children ? <div className="mt-one flex gap-two">{children}</div> : null}
    </div>
  );
}
