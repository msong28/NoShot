import type { ReactNode } from 'react';

/**
 * The 44x44 icon tile from the README's "list row" atom spec -- holds a
 * bet-type emoji or a neutral lucide icon, reused anywhere a row/card needs
 * a leading glyph (list rows, attention cards).
 */
export function IconTile({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success';
}) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-small text-lg ${
        tone === 'success' ? 'bg-up-soft text-up-ink' : 'bg-surface-sunken text-text-secondary'
      }`}
    >
      {children}
    </span>
  );
}
