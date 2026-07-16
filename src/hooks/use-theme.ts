import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/providers/theme-provider';

export function useTheme() {
  const { scheme } = useThemeMode();
  return Colors[scheme];
}
