import type { ReactNode } from 'react';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type Theme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'seerr-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

interface ThemeProviderProps {
  children: ReactNode;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isTheme = (theme: string | null): theme is Theme =>
  theme === 'dark' || theme === 'light';

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.classList.toggle('theme-light', theme === 'light');
  root.classList.toggle('theme-dark', theme === 'dark');

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  themeColor?.setAttribute(
    'content',
    theme === 'light' ? '#f8fafc' : '#1f2937'
  );
};

const getStoredTheme = (): Theme | undefined => {
  let storedTheme: string | null = null;

  try {
    storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return undefined;
  }

  if (isTheme(storedTheme)) {
    return storedTheme;
  }

  return undefined;
};

const persistTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

const getPreferredTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setCurrentTheme] = useState<Theme>('dark');

  useEffect(() => {
    const storedTheme = getStoredTheme();
    const preferredTheme = getPreferredTheme();

    setCurrentTheme(preferredTheme);
    if (storedTheme) {
      persistTheme(preferredTheme);
    }
    applyTheme(preferredTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = () => {
      if (!getStoredTheme()) {
        const nextTheme = mediaQuery.matches ? 'light' : 'dark';
        setCurrentTheme(nextTheme);
        applyTheme(nextTheme);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    persistTheme(nextTheme);
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [setTheme, theme]);

  return createElement(
    ThemeContext.Provider,
    { value: { theme, setTheme, toggleTheme } },
    children
  );
};

const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

export default useTheme;
