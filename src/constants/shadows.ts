import type { ViewStyle } from 'react-native';

/**
 * Elevation, see DESIGN_SYSTEM.md §4. Dark mode leans on surface/border tone
 * rather than shadow depth (shadows barely read on a near-black background);
 * light mode gets a small, soft shadow. Neither theme uses heavy drop
 * shadows -- `raised` is for modals/sheets only, not routine cards.
 */
export const Shadows: Record<'light' | 'dark', Record<'none' | 'low' | 'raised', ViewStyle>> = {
  light: {
    none: {},
    low: {
      shadowColor: '#1A1713',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    raised: {
      shadowColor: '#1A1713',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
  },
  dark: {
    none: {},
    low: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    raised: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 6,
    },
  },
};
