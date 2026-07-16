import type { ThemeColor } from '@/constants/theme';

/**
 * Variant -> semantic color role maps, see DESIGN_SYSTEM.md §7. Components
 * branch on a variant name and look up roles here rather than each
 * hard-coding its own color logic -- keeps Button/StatusBadge consistent
 * and keeps the roles in one place if they need to change.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export const ButtonVariants: Record<ButtonVariant, { bg: ThemeColor; text: ThemeColor }> = {
  primary: { bg: 'primary', text: 'onPrimary' },
  secondary: { bg: 'secondary', text: 'onSecondary' },
  outline: { bg: 'surface', text: 'textPrimary' },
  ghost: { bg: 'surface', text: 'textPrimary' },
  destructive: { bg: 'danger', text: 'onDanger' },
};

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const StatusVariants: Record<StatusVariant, { bg: ThemeColor; text: ThemeColor }> = {
  success: { bg: 'success', text: 'onSuccess' },
  warning: { bg: 'warning', text: 'onWarning' },
  danger: { bg: 'danger', text: 'onDanger' },
  info: { bg: 'info', text: 'onInfo' },
  neutral: { bg: 'surfaceMuted', text: 'textSecondary' },
};
