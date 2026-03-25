import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { applyTokens, buildTokens, ColorScheme, ThemeMode } from '../theme/tokens';

const STORAGE_KEY = 'fidelis-theme';

interface ThemeState {
  mode: ThemeMode;
  scheme: ColorScheme;
}

interface ThemeContextValue extends ThemeState {
  toggleMode: () => void;
  setScheme: (scheme: ColorScheme) => void;
  exportTheme: () => string;
  importTheme: (json: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadTheme(): ThemeState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as ThemeState;
  } catch { /* ignore */ }
  // Respect OS preference as default
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { mode: prefersDark ? 'dark' : 'light', scheme: 'default' };
}

function saveTheme(state: ThemeState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, setState] = useState<ThemeState>(loadTheme);

  const apply = useCallback((next: ThemeState) => {
    applyTokens(buildTokens(next.mode, next.scheme));
    document.documentElement.setAttribute('data-theme', next.mode);
    saveTheme(next);
    setState(next);
  }, []);

  // Apply on mount
  useEffect(() => { apply(state); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMode = useCallback(() => {
    apply({ ...state, mode: state.mode === 'dark' ? 'light' : 'dark' });
  }, [state, apply]);

  const setScheme = useCallback((scheme: ColorScheme) => {
    apply({ ...state, scheme });
  }, [state, apply]);

  const exportTheme = useCallback(() => JSON.stringify(state), [state]);

  const importTheme = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as ThemeState;
      apply(parsed);
    } catch { /* ignore invalid JSON */ }
  }, [apply]);

  return (
    <ThemeContext.Provider value={{ ...state, toggleMode, setScheme, exportTheme, importTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
