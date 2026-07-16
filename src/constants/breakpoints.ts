import { MaxContentWidth } from '@/constants/theme';

/**
 * Responsive tokens, see DESIGN_SYSTEM.md §8. Mobile is the primary target;
 * on wider web viewports content stays constrained and centered rather than
 * stretching into a desktop dashboard.
 */
export const Breakpoints = {
  tablet: 768,
  web: 1024,
  maxContentWidth: MaxContentWidth,
} as const;
