import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'noshot-theme-mode';

function applyTheme(mode: ThemeMode) {
  if (mode === 'auto') {
    // No explicit attribute -- index.css's plain `:root` (light) plus its
    // `@media (prefers-color-scheme: dark)` override then decides, exactly
    // like the two explicit `:root[data-theme=...]` blocks do when set.
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }
}

function readStored(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'dark';
}

/**
 * The Settings screen's "Dark mode" row -- previously just a static
 * `data-theme="dark"` in index.html with no way to change it. Persists to
 * localStorage (no account-level sync; this app has no profile field for
 * it) and defaults to 'dark', matching the previous hardcoded behavior for
 * anyone who's never touched the setting.
 */
export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(readStored);

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  function setMode(next: ThemeMode) {
    window.localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }

  return { mode, setMode };
}
