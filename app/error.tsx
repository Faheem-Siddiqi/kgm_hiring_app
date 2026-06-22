"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorFallback error={error} retry={unstable_retry} />;
}
