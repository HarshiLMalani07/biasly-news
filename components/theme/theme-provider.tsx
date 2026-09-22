"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  applyTheme,
  prefersDark,
  readStoredTheme,
  storeTheme,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  /** What the reader picked: "system" stays "system". */
  theme: Theme;
  /** What is actually painted right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialiser, so the first client render reads the same localStorage
  // value the inline script in the layout already acted on.
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(prefersDark);

  // Derived, not stored: a second state would have to be written from an
  // effect, which cascades renders.
  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  // Before paint, not after: React Strict Mode's dev remount resets <html> to
  // the attributes it manages from JSX, wiping the class the inline script set.
  // A no-op in production, where the class is already correct.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme, resolvedTheme]);

  // Keeps "Auto" following the OS while the page stays open.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    storeTheme(next);
    setThemeState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>.");
  }

  return context;
}
