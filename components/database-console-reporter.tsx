"use client";

import { useEffect } from "react";

export function DatabaseConsoleReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    fetch("/api/database/status")
      .then(async (response) => {
        if (!response.ok) return;
        console.info("[database] MongoDB connection successful.", await response.json());
      })
      .catch(() => {
        // The global client instrumentation reports the full network failure.
      });
  }, []);

  return null;
}
