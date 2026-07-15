import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { CurrencyCategories, type CurrencyCategory } from '@/lib/currency';

type CategoryPickerProps = {
  value: CurrencyCategory;
  onChange: (category: CurrencyCategory) => void;
};

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <View style={styles.row}>
      {CurrencyCategories.map((category) => (
        <Button
          key={category.value}
          variant={value === category.value ? 'accent' : 'muted'}
          onPress={() => onChange(category.value)}
        >
          {category.label}
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
