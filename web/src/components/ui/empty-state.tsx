import type { ReactNode } from 'react';

import { Icons, type IconName } from '@/lib/icons';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = icon ? Icons[icon] : undefined;

  return (
    <div className="flex flex-col items-center gap-two rounded-large bg-surface-sunken p-five text-center">
      {Icon ? <Icon size={32} strokeWidth={1.5} className="text-text-faint" /> : null}
      <p className="font-display font-bold">{title}</p>
      {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      {action}
    </div>
  );
}
