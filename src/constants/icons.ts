import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/**
 * Semantic icon registry, see DESIGN_SYSTEM.md §6. Feature code asks for
 * `Icons.friend`, never a raw Ionicons glyph name directly -- keeps the
 * mapping swappable in one place and keeps icon style consistent app-wide.
 * Ionicons is the one icon family in use (over expo-symbols, which is
 * iOS-only -- see DECISIONS.md).
 */
type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const Icons = {
  home: 'home-outline',
  groups: 'people-outline',
  friends: 'person-add-outline',
  activity: 'time-outline',
  account: 'person-circle-outline',
  currency: 'pricetag-outline',
  bet: 'flag-outline',
  obligations: 'receipt-outline',
  balances: 'swap-horizontal-outline',
  add: 'add',
  back: 'chevron-back',
  forward: 'chevron-forward',
  close: 'close',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  search: 'search',
  themeLight: 'sunny-outline',
  themeDark: 'moon-outline',
  themeSystem: 'phone-portrait-outline',
  warning: 'warning-outline',
  info: 'information-circle-outline',
  danger: 'alert-circle-outline',
  block: 'ban-outline',
  qrCode: 'qr-code-outline',
  leave: 'exit-outline',
  archive: 'archive-outline',
  remove: 'trash-outline',
} as const satisfies Record<string, IoniconName>;

export type IconName = keyof typeof Icons;
