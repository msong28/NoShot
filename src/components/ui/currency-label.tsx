import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type CurrencyLabelProps = {
  quantity: number;
  currency: { name: string; icon: string | null };
};

/** Renders "2 Meal" / "12 Coffee" consistently -- currencies are never combined across types (§5.1). */
export function CurrencyLabel({ quantity, currency }: CurrencyLabelProps) {
  return (
    <View style={styles.row}>
      {currency.icon ? <ThemedText>{currency.icon}</ThemedText> : null}
      <ThemedText type="bodySM" themeColor="textSecondary">
        {quantity} {currency.name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
});
