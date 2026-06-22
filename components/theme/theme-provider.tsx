"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

export const ThemeContext = createContext<{
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}>({ resolvedTheme: "light", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const savedTheme = window.localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const setTheme = useCallback((theme: Theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("theme", theme);
    setResolvedTheme(theme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
    window.localStorage.setItem("theme", resolvedTheme);
  }, [resolvedTheme]);

  const value = useMemo(() => ({ resolvedTheme, setTheme }), [resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
