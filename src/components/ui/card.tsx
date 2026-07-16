import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { Shadows } from '@/constants/shadows';
import { useThemeMode } from '@/providers/theme-provider';

type CardProps = ViewProps & {
  /** Modals/sheets only, per DESIGN_SYSTEM.md §4 -- not for routine cards. */
  elevated?: boolean;
};

export function Card({ style, elevated = false, ...rest }: CardProps) {
  const { scheme } = useThemeMode();

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, elevated && Shadows[scheme].low, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
});
