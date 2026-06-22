"use client";

import { useContext, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeContext } from "@/components/theme/theme-provider";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useContext(ThemeContext);
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="transition-all duration-300"
        disabled
        aria-label="Toggle theme"
        suppressHydrationWarning
      >
        <Sun className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      variant="outline"
      size="icon"
      className="transition-all duration-300"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      suppressHydrationWarning
    >
      <Icon className="size-4" />
    </Button>
  );
}
