"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { emitDiagnostic } from "@/lib/client-diagnostics";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  retry: () => void;
  global?: boolean;
};

export function ErrorFallback({ error, retry, global = false }: ErrorFallbackProps) {
  useEffect(() => {
    emitDiagnostic({
      id: error.digest ?? crypto.randomUUID(),
      title: "React error boundary",
      message: error.message,
      source: "React",
      timestamp: new Date().toISOString(),
      url: window.location.href,
      stack: error.stack,
      context: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  const content = (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-lg">
        <p className="text-sm font-semibold text-destructive">Application error</p>
        <h1 className="mt-2 text-2xl font-bold">This page could not be displayed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The error was captured. Retry the page, or use the diagnostic details below while debugging.
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-5 max-h-80 overflow-auto rounded-xl bg-muted p-4 text-xs whitespace-pre-wrap">
            {error.name}: {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}
        <div className="mt-5 flex gap-3">
          <Button onClick={retry}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </section>
    </main>
  );

  return global ? <html lang="en"><body>{content}</body></html> : content;
}
