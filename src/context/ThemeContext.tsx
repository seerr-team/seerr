import React, { createContext, useCallback, useEffect, useState } from 'react';

export type ThemeId = 'default' | 'amoled-strix';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Preview swatch colors [bg, surface, accent] */
  swatches: [string, string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Classic dark theme',
    swatches: ['#111827', '#1f2937', '#6366f1'],
  },
  {
    id: 'amoled-strix',
    name: 'AMOLED Strix',
    description: 'Pure black with violet accents, optimized for OLED displays',
    swatches: ['#000000', '#080808', '#8b5cf6'],
  },
];

const STORAGE_KEY = 'seerr-theme';
const DEFAULT_THEME: ThemeId = 'default';

export interface ThemeContextProps {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  theme: DEFAULT_THEME,
  setTheme: () => void 0,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const resolved = stored && THEMES.find((t) => t.id === stored) ? stored : DEFAULT_THEME;
    setThemeState(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

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
