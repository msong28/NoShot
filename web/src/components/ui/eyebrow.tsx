import type { ReactNode } from 'react';

/**
 * Mono, uppercase, wide-tracked label -- README's "eyebrow" type role
 * (dates, "YOUR STANDING", "GROUP · 4", etc). Distinct from SectionHeader,
 * which is a sentence-case bold heading, not a mono label.
 */
export function Eyebrow({
  children,
  className = '',
  color = 'text-ink-faint',
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <p
      className={`font-mono text-eyebrow tracking-eyebrow font-bold uppercase ${color} ${className}`}
    >
      {children}
    </p>
  );
}
