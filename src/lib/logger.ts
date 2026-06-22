import "server-only";

import type { ErrorSource } from "@/src/lib/errors/app-error";

const SECRET_KEY = /authorization|cookie|password|passwd|secret|token|uri|connectionstring/i;
const CREDENTIALS_IN_URL = /(mongodb(?:\+srv)?:\/\/[^:\s]+:)[^@\s]+@/gi;

export type ErrorLog = {
  id: string;
  source: ErrorSource;
  code: string;
  name: string;
  message: string;
  timestamp: string;
  operation: string;
  path?: string;
  status: number;
  context?: Record<string, unknown>;
  causes: string[];
  stack?: string;
};

export function isDevMode() {
  return process.env.DEV_MODE?.trim().toLowerCase() === "true";
}

function redactText(value: string) {
  return value
    .replace(CREDENTIALS_IN_URL, "$1[REDACTED]@")
    .replace(/(password|passwd|token|secret)(\s*[=:]\s*)[^\s,;]+/gi, "$1$2[REDACTED]");
}

export function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactText(value);
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? "[REDACTED]" : sanitize(item, seen),
    ]),
  );
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function getCauseMessages(error: Error) {
  const causes: string[] = [];
  const visited = new Set<unknown>();
  let cause = error.cause;

  while (cause !== undefined && cause !== null && !visited.has(cause) && causes.length < 8) {
    visited.add(cause);
    const causeError = toError(cause);
    causes.push(redactText(`${causeError.name}: ${causeError.message}`));
    cause = causeError.cause;
  }
  return causes;
}

export function logError(report: ErrorLog) {
  if (!isDevMode()) {
    console.error(`[${report.source}] ${report.code} (${report.id})`);
    return;
  }

  console.error(
    [
      `${report.source} ERROR: ${report.name}`,
      `Message: ${report.message}`,
      `Operation: ${report.operation}`,
      `Request path: ${report.path ?? "n/a"}`,
      `HTTP status: ${report.status}`,
      `Code: ${report.code}`,
      `Error ID: ${report.id}`,
      `Timestamp: ${report.timestamp}`,
      report.context ? `Context:\n${JSON.stringify(report.context, null, 2)}` : undefined,
      report.causes.length ? `Cause chain:\n${report.causes.join("\n")}` : undefined,
      report.stack ? `Stack trace:\n${report.stack}` : undefined,
    ].filter(Boolean).join("\n\n"),
  );
}
