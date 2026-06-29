"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error("Tabs components must be used inside Tabs.");
  }

  return context;
}

function Tabs({
  value,
  onValueChange,
  className,
  ...props
}: React.ComponentProps<"div"> & TabsContextValue) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div data-slot="tabs" className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  );
}

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "line" }) {
  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={cn(
        variant === "line"
          ? "flex w-full gap-1 overflow-x-auto border-b"
          : "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & { value: string }) {
  const { value: activeValue, onValueChange } = useTabsContext();
  const active = activeValue === value;

  return (
    <button
      data-slot="tabs-trigger"
      role="tab"
      type="button"
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      className={cn(
        "inline-flex min-w-fit items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:border-primary data-[state=active]:text-foreground",
        className,
      )}
      onClick={() => onValueChange(value)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger };
