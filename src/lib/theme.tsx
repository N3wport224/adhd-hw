"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "adhd-hw:theme";

/**
 * Runs before first paint so the page never flashes the wrong theme — a white
 * flash on a dark-mode load is exactly the kind of jolt this app exists to
 * avoid. Kept in sync with the storage key below.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

/**
 * The `dark` class on <html> is the single source of truth — the init script
 * sets it before React exists, so React subscribes to the DOM rather than
 * keeping a second copy of the answer that could disagree with it.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// Pre-hydration HTML is rendered with the light palette; the init script has
// already applied the real theme to <html> by the time anything is visible.
function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage being unavailable only costs persistence, not the toggle.
  }
  for (const listener of listeners) listener();
}

interface ThemeValue {
  theme: Theme;
  toggleTheme(): void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    applyTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
