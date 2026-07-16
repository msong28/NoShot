import { render as rtlRender, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';

export * from '@testing-library/react-native';

/** Wraps every render in ThemeProvider -- useTheme()/ThemedText etc. need it. */
export function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: ThemeProvider, ...options });
}
