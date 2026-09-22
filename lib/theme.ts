/**
 * Theme state, shared by the inline <head> script in app/layout.tsx and the
 * React provider. Both must read the same key and apply the same rule, or the
 * DOM the script produces and React's first render disagree.
 *
 * Deliberately free of "use client" and "server-only": the layout imports the
 * script string on the server, the provider imports the helpers on the client.
 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "biasly-theme";
export const DEFAULT_THEME: Theme = "light";

/** The class globals.css hangs the dark palette off, via `:root.dark`. */
const DARK_CLASS = "dark";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}

export function prefersDark(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") {
    return theme;
  }

  return prefersDark() ? "dark" : "light";
}

/** Reading localStorage throws in Safari private mode, so never let it escape. */
export function readStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked or full: the choice still applies for this page view.
  }
}

/** The only place in the app that touches the documentElement class list. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle(
    DARK_CLASS,
    resolveTheme(theme) === "dark"
  );
}

/**
 * Runs synchronously while the browser parses <head>, so the palette is right
 * before the first paint rather than after hydration. ES5 only - it executes
 * before any bundle and must not depend on the app's transpilation. Built from
 * the constants above so the key and class can never drift from the TS code;
 * nothing external is interpolated into it.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t!=="light"&&t!=="dark"&&t!=="system"){t=${JSON.stringify(
  DEFAULT_THEME
)};}var d=t==="dark"||(t==="system"&&window.matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY
)}).matches);document.documentElement.classList.toggle(${JSON.stringify(
  DARK_CLASS
)},d);}catch(e){}})();`;
