import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { applyLayout, applyTokens, buildTokens, ColorScheme, LayoutTokens, ThemeMode } from '../theme/tokens';

const STORAGE_KEY = 'fidelis-theme';

interface ThemeState {
  mode: ThemeMode;
  scheme: ColorScheme;
  layout: LayoutTokens;
}

interface ThemeContextValue extends ThemeState {
  toggleMode: () => void;
  setScheme: (scheme: ColorScheme) => void;
  setLayout: (layout: Partial<LayoutTokens>) => void;
  exportTheme: () => string;
  importTheme: (json: string) => void;
}

const DEFAULT_LAYOUT: LayoutTokens = { density: 'comfortable', fontScale: 1, borderRadius: 'rounded' };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadTheme(): ThemeState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ThemeState>;
      return { mode: parsed.mode ?? 'dark', scheme: parsed.scheme ?? 'default', layout: { ...DEFAULT_LAYOUT, ...parsed.layout } };
    }
  } catch { /* ignore */ }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { mode: prefersDark ? 'dark' : 'light', scheme: 'default', layout: DEFAULT_LAYOUT };
}

function saveTheme(state: ThemeState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Minimal analytics: track theme changes in sessionStorage
function trackThemeChange(event: string, value: string): void {
  try {
    const key = 'fidelis-theme-analytics';
    const existing = JSON.parse(sessionStorage.getItem(key) ?? '[]') as Array<{ event: string; value: string; ts: number }>;
    existing.push({ event, value, ts: Date.now() });
    sessionStorage.setItem(key, JSON.stringify(existing.slice(-50))); // keep last 50
  } catch { /* ignore */ }
}

export function getThemeAnalytics(): Array<{ event: string; value: string; ts: number }> {
  try {
    return JSON.parse(sessionStorage.getItem('fidelis-theme-analytics') ?? '[]');
  } catch { return []; }
}

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, setState] = useState<ThemeState>(loadTheme);

  const apply = useCallback((next: ThemeState) => {
    applyTokens(buildTokens(next.mode, next.scheme));
    applyLayout(next.layout);
    document.documentElement.setAttribute('data-theme', next.mode);
    document.documentElement.setAttribute('data-scheme', next.scheme);
    saveTheme(next);
    setState(next);
  }, []);

  useEffect(() => { apply(state); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMode = useCallback(() => {
    const next = { ...state, mode: state.mode === 'dark' ? 'light' : 'dark' } as ThemeState;
    trackThemeChange('mode', next.mode);
    apply(next);
  }, [state, apply]);

  const setScheme = useCallback((scheme: ColorScheme) => {
    trackThemeChange('scheme', scheme);
    apply({ ...state, scheme });
  }, [state, apply]);

  const setLayout = useCallback((layout: Partial<LayoutTokens>) => {
    const next = { ...state, layout: { ...state.layout, ...layout } };
    trackThemeChange('layout', JSON.stringify(layout));
    apply(next);
  }, [state, apply]);

  const exportTheme = useCallback(() => JSON.stringify(state), [state]);

  const importTheme = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as Partial<ThemeState>;
      const next: ThemeState = {
        mode: parsed.mode ?? state.mode,
        scheme: parsed.scheme ?? state.scheme,
        layout: { ...DEFAULT_LAYOUT, ...parsed.layout },
      };
      trackThemeChange('import', next.scheme);
      apply(next);
    } catch { /* ignore invalid JSON */ }
  }, [state, apply]);

  return (
    <ThemeContext.Provider value={{ ...state, toggleMode, setScheme, setLayout, exportTheme, importTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
