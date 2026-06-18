"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="min-w-28 transition-all duration-300"
        disabled
        suppressHydrationWarning
      >
        Theme
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      variant="outline"
      size="sm"
      className="min-w-28 transition-all duration-300"
      onClick={() => setTheme(nextTheme)}
      suppressHydrationWarning
    >
      <Icon className="size-4" />
      {isDark ? "Light mode" : "Dark mode"}
    </Button>
  );
}
