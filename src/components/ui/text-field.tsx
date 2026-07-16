import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  /** 'search' hides the visible label (kept as the accessibility label) and adds a leading icon. */
  variant?: 'default' | 'search';
};

export function TextField({ label, error, variant = 'default', style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const isSearch = variant === 'search';

  return (
    <View style={styles.container}>
      {!isSearch ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <View style={styles.inputRow}>
        {isSearch ? (
          <Icon name="search" size={18} color="textSecondary" style={styles.searchIcon} />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            isSearch && styles.inputWithIcon,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <ThemedText type="small" themeColor="negative">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  inputRow: {
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: Spacing.three,
    zIndex: 1,
  },
  input: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingLeft: Spacing.three + 24,
  },
});
