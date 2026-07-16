import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  ButtonVariants,
  type ButtonVariant as NamedButtonVariant,
} from '@/constants/component-variants';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// 'accent'/'muted' are the original two variants, kept exactly as they
// rendered before so existing screens don't change look until Phase 4
// migrates them to the named set in component-variants.ts.
export type ButtonVariant = 'accent' | 'muted' | NamedButtonVariant;

type ButtonProps = PressableProps & {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({
  children,
  variant = 'accent',
  loading = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const named = variant !== 'accent' && variant !== 'muted' ? ButtonVariants[variant] : null;

  const backgroundColor = named
    ? theme[named.bg]
    : variant === 'accent'
      ? theme.accent
      : theme.backgroundElement;
  const textColor = named
    ? theme[named.text]
    : variant === 'accent'
      ? theme.accentText
      : theme.text;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={(state) => [
        styles.base,
        { backgroundColor },
        variant === 'outline' && { borderWidth: 1, borderColor: theme.border },
        state.pressed && styles.pressed,
        isDisabled && !loading && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <ThemedText type="smallBold" style={[styles.label, { color: textColor }]}>
          {children}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    textAlign: 'center',
  },
});
