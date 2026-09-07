'use client';

import * as React from 'react';
import { Moon, Sun } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export const THEMES = ['beaver', 'beaver-dark'] as const;
export type BeaverTheme = (typeof THEMES)[number];
const STORAGE_KEY = 'beaver-theme';

function readStored(): BeaverTheme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'beaver' || v === 'beaver-dark' ? v : null;
  } catch {
    return null;
  }
}

/** Apply the theme to <html> without a full reload. */
export function applyTheme(theme: BeaverTheme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

const ThemeContext = React.createContext<{ theme: BeaverTheme; toggle: () => void }>({
  theme: 'beaver',
  toggle: () => {},
});

export function useThemeMode() {
  return React.useContext(ThemeContext);
}

/** Provides the Beaver light/dark theme. Wrap once in root Providers. */
export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<BeaverTheme>('beaver');

  // One-time sync of React state with the persisted theme (external system:
  // localStorage). The DOM itself is already correct via the boot script in layout.
  React.useEffect(() => {
    const stored = readStored();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync from external persisted state
      setTheme(stored);
    }
  }, []);

  const toggle = React.useCallback(() => {
    setTheme((t) => {
      const next: BeaverTheme = t === 'beaver' ? 'beaver-dark' : 'beaver';
      applyTheme(next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

/** Sun/moon toggle button for app bars and settings screens. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemeMode();
  const dark = theme === 'beaver-dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'tap grid size-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        className,
      )}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
