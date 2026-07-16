import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens, see DESIGN_SYSTEM.md §5. Two categories:
 *
 * - Routine (navigation, list updates, form feedback): fast, no bounce --
 *   felt, not watched. Use `Motion.duration.fast/base` with `Motion.easing.standard`.
 * - Celebration (bet accepted/activated, winner confirmed, obligation
 *   redeemed, group created): more expressive, spring-based, brief, and
 *   always skippable. Use `Motion.spring.celebrate`, gated by
 *   `useReducedMotion()` from react-native-reanimated -- when the user
 *   prefers reduced motion, apply the end state directly, no animation.
 */
export const Motion = {
  duration: {
    fast: 150,
    base: 200,
    slow: 320,
    celebrate: 800,
  },
  easing: {
    standard: Easing.out(Easing.cubic),
    enter: Easing.out(Easing.quad),
    exit: Easing.in(Easing.quad),
  },
  spring: {
    routine: { damping: 20, stiffness: 220, mass: 1 },
    celebrate: { damping: 12, stiffness: 180, mass: 1 },
  },
} as const;
