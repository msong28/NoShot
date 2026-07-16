import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { TypeScale, type TypeScaleToken } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';

// Legacy type names kept alongside the new named scale (DESIGN_SYSTEM.md §3)
// so existing screens render unchanged until Phase 4 migrates them one by
// one -- retire these once nothing references them anymore.
type LegacyTextType = 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'code';

export type ThemedTextProps = TextProps & {
  type?: LegacyTextType | TypeScaleToken;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const scaleStyle = (TypeScale as Record<string, (typeof TypeScale)[TypeScaleToken]>)[type];

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        scaleStyle,
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
