/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Semantic tokens, see DESIGN_SYSTEM.md §2. Same warm undertone and same
 * roles in both themes -- only the values differ (light mode isn't dark
 * mode inverted: `primary`/`competitive` are deliberately darker/more
 * saturated in light mode, since the neon value that pops on near-black
 * washes out on off-white).
 */
const light = {
  background: '#FBF7F0',
  surface: '#FFFFFF',
  surfaceRaised: '#F5F0E6',
  surfaceMuted: '#F1ECE1',
  textPrimary: '#1A1713',
  textSecondary: '#5A5548',
  textMuted: '#8B8576',
  border: '#E6E0D2',
  primary: '#77A600',
  primaryPressed: '#5E8700',
  onPrimary: '#FFFFFF',
  secondary: '#6C4FE0',
  secondaryPressed: '#5A3FC2',
  onSecondary: '#FFFFFF',
  competitive: '#E1512E',
  onCompetitive: '#FFFFFF',
  success: '#1E9E5A',
  onSuccess: '#FFFFFF',
  warning: '#B8860B',
  onWarning: '#FFFFFF',
  danger: '#E23F5D',
  onDanger: '#FFFFFF',
  info: '#1D6FC4',
  onInfo: '#FFFFFF',
  overlay: 'rgba(26, 23, 19, 0.4)',
} as const;

const dark = {
  background: '#100F0D',
  surface: '#1C1A17',
  surfaceRaised: '#242119',
  surfaceMuted: '#16140F',
  textPrimary: '#F7F4EE',
  textSecondary: '#B6B0A2',
  textMuted: '#7C776A',
  border: '#302B22',
  primary: '#C6F135',
  primaryPressed: '#A9D428',
  onPrimary: '#14130F',
  secondary: '#9B7BFF',
  secondaryPressed: '#8362E8',
  onSecondary: '#FFFFFF',
  competitive: '#FF6B4A',
  onCompetitive: '#14130F',
  success: '#3ED686',
  onSuccess: '#0F1F16',
  warning: '#FFB020',
  onWarning: '#1F1506',
  danger: '#FF5D7A',
  onDanger: '#FFFFFF',
  info: '#5AA9E6',
  onInfo: '#0B1B26',
  overlay: 'rgba(10, 9, 7, 0.64)',
} as const;

export const Colors = {
  light: {
    ...light,
    focus: light.primary,
    // Legacy aliases -- kept so existing screens (friends.tsx, groups.tsx,
    // etc.) don't break. New code should prefer the semantic names above.
    text: light.textPrimary,
    backgroundElement: light.surface,
    backgroundSelected: light.surfaceMuted,
    accent: light.secondary,
    accentText: light.onSecondary,
    positive: light.success,
    negative: light.danger,
  },
  dark: {
    ...dark,
    focus: dark.primary,
    text: dark.textPrimary,
    backgroundElement: dark.surface,
    backgroundSelected: dark.surfaceMuted,
    accent: dark.secondary,
    accentText: dark.onSecondary,
    positive: dark.success,
    negative: dark.danger,
  },
} as const;

/**
 * Distinct accent colours for currency categories, per the PRD's "distinct iconography
 * and accent treatment" requirement. Never the sole signal of owed/owing status.
 */
export const CurrencyCategoryColors = {
  food: '#FF8A3D',
  drinks: '#3DB8FF',
  items: '#9B7BFF',
  favours: '#3ED686',
  chores: '#FFD23D',
  actions: '#FF5D9E',
  points: '#5DE3FF',
  money: '#7C5CFF',
  custom: '#B0B4BA',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  small: 8,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
