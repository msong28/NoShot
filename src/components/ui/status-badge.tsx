import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { StatusVariants, type StatusVariant } from '@/constants/component-variants';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatusBadgeProps = {
  label: string;
  variant: StatusVariant;
};

/**
 * A filled status pill ("Pending review," "Invited," "Owner") -- distinct
 * from the Milestone-0 `Badge` (a dot + label, used for currency
 * categories). Never the only signal: always paired with the text label.
 */
export function StatusBadge({ label, variant }: StatusBadgeProps) {
  const theme = useTheme();
  const colors = StatusVariants[variant];

  return (
    <View style={[styles.badge, { backgroundColor: theme[colors.bg] }]}>
      <ThemedText type="caption" style={{ color: theme[colors.text], fontWeight: '700' }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radii.pill,
  },
});
