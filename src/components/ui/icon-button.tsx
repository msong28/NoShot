import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import type { ThemeColor } from '@/constants/theme';
import type { IconName } from '@/constants/icons';

type IconButtonProps = Omit<PressableProps, 'accessibilityLabel'> & {
  name: IconName;
  size?: number;
  color?: ThemeColor;
  /** Required, not optional -- an icon-only button needs a label to be usable with a screen reader. */
  accessibilityLabel: string;
};

export function IconButton({
  name,
  size = 22,
  color = 'textPrimary',
  style,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={(state) => [
        styles.base,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
