import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = PressableProps & {
  children: ReactNode;
  variant?: 'accent' | 'muted';
};

export function Button({ children, variant = 'accent', style, ...rest }: ButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      style={(state) => [
        styles.base,
        { backgroundColor: variant === 'accent' ? theme.accent : theme.backgroundElement },
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <ThemedText
        type="smallBold"
        themeColor={variant === 'accent' ? 'accentText' : 'text'}
        style={styles.label}
      >
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    textAlign: 'center',
  },
});
