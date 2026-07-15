import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

type BadgeProps = {
  label: string;
  /** Category/status accent colour. Always paired with the text label — never the sole signal. */
  color: string;
};

export function Badge({ label, color }: BadgeProps) {
  return (
    <ThemedView type="backgroundSelected" style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small">{label}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
    borderRadius: Radii.pill,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radii.pill,
  },
});
