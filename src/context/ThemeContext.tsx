import React, { createContext, useCallback, useState } from 'react';

export type ThemeId = 'default' | 'amoled-strix';

export interface ThemeDefinition {
  id: ThemeId;
  swatches: [string, string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    swatches: ['#111827', '#1f2937', '#6366f1'],
  },
  {
    id: 'amoled-strix',
    swatches: ['#000000', '#080808', '#8b5cf6'],
  },
];

const STORAGE_KEY = 'seerr-theme';
const DEFAULT_THEME: ThemeId = 'default';

function resolveInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.find((t) => t.id === stored)) {
      document.documentElement.setAttribute('data-theme', stored);
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_THEME;
}

const initialTheme = resolveInitialTheme();

export interface ThemeContextProps {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  theme: DEFAULT_THEME,
  setTheme: () => void 0,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
