import { SegmentedControl } from '@/components/ui/segmented-control';
import { useThemeMode } from '@/providers/theme-provider';

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();

  return (
    <SegmentedControl
      value={mode}
      onChange={setMode}
      options={[
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  );
}
