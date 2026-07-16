import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { Icons, type IconName } from '@/constants/icons';
import { useTheme } from '@/hooks/use-theme';

type IconProps = {
  name: IconName;
  size?: number;
  color?: ThemeColor;
  style?: StyleProp<TextStyle>;
};

export function Icon({ name, size = 20, color = 'textPrimary', style }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={Icons[name]} size={size} color={theme[color]} style={style} />;
}
