import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Generic scannable row -- replaces the `styles.row` flexbox pattern that
 * was copy-pasted across friends/groups/currencies (see DESIGN_SYSTEM.md
 * §7). Not a GroupRow/BalanceRow duplicate: those compose this with
 * Avatar/CurrencyLabel at the call site instead.
 */
export function ListRow({ leading, title, subtitle, trailing, onPress, style }: ListRowProps) {
  const content = (
    <Card style={[styles.row, style]}>
      {leading}
      <View style={styles.textContainer}>
        <ThemedText type="body" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="bodySM" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
    </Card>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  textContainer: {
    flex: 1,
    gap: Spacing.half,
  },
});
