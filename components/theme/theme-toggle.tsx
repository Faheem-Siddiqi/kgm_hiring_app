"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [isSwitching, setIsSwitching] = useState(false);
  const switchingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const nextTheme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  function handleThemeChange() {
    if (switchingTimer.current) {
      clearTimeout(switchingTimer.current);
    }

    setIsSwitching(true);
    setTheme(nextTheme);
    switchingTimer.current = setTimeout(() => {
      setIsSwitching(false);
    }, 450);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="min-w-28 transition-all duration-300"
      onClick={handleThemeChange}
      disabled={isSwitching}
      suppressHydrationWarning
    >
      <Icon className="size-4" />
      {isSwitching ? "Switching" : "Theme"}
    </Button>
  );
}
