import "server-only";

export { AppError } from "@/src/lib/errors/app-error";
export {
  createApiErrorResponse as errorResponse,
  withApiErrorHandler,
  withErrorHandler,
} from "@/src/lib/errors/error-handler";
export { isDevMode } from "@/src/lib/logger";

import type { ErrorSource } from "@/src/lib/errors/app-error";
import { getCauseMessages, isDevMode, logError, sanitize, toError } from "@/src/lib/logger";

export type DevErrorDiagnostic = {
  id: string;
  source: ErrorSource;
  code: string;
  message: string;
  timestamp: string;
  url?: string;
  context?: Record<string, unknown>;
  causes?: string[];
  stack?: string;
};

export function logServerError(error: unknown, context?: Record<string, unknown>) {
  const normalized = toError(error);
  const report = {
    id: crypto.randomUUID(),
    source: "SERVER" as ErrorSource,
    code: "INTERNAL_ERROR",
    name: normalized.name,
    message: String(sanitize(normalized.message)),
    timestamp: new Date().toISOString(),
    operation: typeof context?.operation === "string" ? context.operation : "server-request",
    path: typeof context?.path === "string" ? context.path : undefined,
    status: 500,
    context: context ? (sanitize(context) as Record<string, unknown>) : undefined,
    causes: getCauseMessages(normalized),
    stack: normalized.stack ? String(sanitize(normalized.stack)) : undefined,
  };
  logError(report);
  return report;
}

export function getDevErrorDiagnostic(
  report: ReturnType<typeof logServerError>,
): DevErrorDiagnostic | undefined {
  if (!isDevMode()) return undefined;

  return {
    id: report.id,
    source: report.source,
    code: report.code,
    message: report.message,
    timestamp: report.timestamp,
    ...(report.path ? { url: report.path } : {}),
    context: {
      errorName: report.name,
      operation: report.operation,
      requestPath: report.path ?? "n/a",
      httpStatus: report.status,
      ...report.context,
    },
    ...(report.causes.length ? { causes: report.causes } : {}),
    ...(report.stack ? { stack: report.stack } : {}),
  };
}
