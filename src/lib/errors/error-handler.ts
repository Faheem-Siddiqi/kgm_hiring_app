import "server-only";

import { NextResponse } from "next/server";

import { AppError, type ErrorSource } from "@/src/lib/errors/app-error";
import { getCauseMessages, isDevMode, logError, sanitize, toError } from "@/src/lib/logger";

export type ApiErrorResponse = {
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

type HandlerOptions = {
  operation: string;
  source?: ErrorSource;
  context?: Record<string, unknown>;
};

type RouteHandler<T extends unknown[]> = (...args: T) => Response | Promise<Response>;

type ClassifiedError = {
  code: string;
  message: string;
  status: number;
  source: ErrorSource;
};

function classifyMongoError(error: Error): ClassifiedError | undefined {
  const details = `${error.name} ${error.message} ${getCauseMessages(error).join(" ")}`.toLowerCase();

  if (/bad auth|authentication failed|auth failed|code\s*18|unauthorized/.test(details)) {
    return { code: "MONGODB_AUTH_FAILED", message: "Database authentication failed.", status: 503, source: "DATABASE" };
  }
  if (/econnrefused|connection refused/.test(details)) {
    return { code: "MONGODB_CONNECTION_REFUSED", message: "The database refused the connection.", status: 503, source: "DATABASE" };
  }
  if (/mongo(parse|api)error|invalid (connection string|scheme)|must begin with mongodb/.test(details)) {
    return { code: "MONGODB_INVALID_URI", message: "The database connection string is invalid.", status: 500, source: "DATABASE" };
  }
  if (/ip.+(allow|access)|not authorized.+ip|network access|whitelist/.test(details)) {
    return { code: "MONGODB_NETWORK_NOT_ALLOWED", message: "Database network access is not allowed.", status: 503, source: "DATABASE" };
  }
  if (/timed?\s*out|timeout|server selection/.test(details)) {
    return { code: "MONGODB_TIMEOUT", message: "The database connection timed out.", status: 504, source: "DATABASE" };
  }
  if (/mongo|mongodb/.test(details)) {
    return { code: "MONGODB_ERROR", message: "The database request failed.", status: 503, source: "DATABASE" };
  }
}

function classifyError(error: Error, fallbackSource: ErrorSource): ClassifiedError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.safeMessage, status: error.status, source: error.source };
  }
  return classifyMongoError(error) ?? {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    status: 500,
    source: fallbackSource,
  };
}

export function createApiErrorResponse(
  caught: unknown,
  request: Request | undefined,
  options: HandlerOptions,
) {
  const error = toError(caught);
  const classified = classifyError(error, options.source ?? "API");
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();
  const url = request ? new URL(request.url).pathname : undefined;
  const context = sanitize({ ...options.context, ...(error instanceof AppError ? error.context : {}) }) as Record<string, unknown>;
  const causes = getCauseMessages(error);

  logError({
    id,
    source: classified.source,
    code: classified.code,
    name: error.name,
    message: String(sanitize(error.message)),
    timestamp,
    operation: options.operation,
    path: url,
    status: classified.status,
    context: Object.keys(context).length ? context : undefined,
    causes,
    stack: error.stack ? String(sanitize(error.stack)) : undefined,
  });

  const body: ApiErrorResponse = {
    id,
    source: classified.source,
    code: classified.code,
    message: isDevMode() ? String(sanitize(error.message)) : classified.message,
    timestamp,
    ...(url ? { url } : {}),
    ...(isDevMode() && Object.keys(context).length ? { context } : {}),
    ...(isDevMode() && causes.length ? { causes } : {}),
    ...(isDevMode() && error.stack ? { stack: String(sanitize(error.stack)) } : {}),
  };

  return NextResponse.json(body, { status: classified.status });
}

export function withApiErrorHandler<T extends unknown[]>(
  handler: RouteHandler<T>,
  options: HandlerOptions,
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] instanceof Request ? args[0] : undefined;
      return createApiErrorResponse(error, request, options);
    }
  };
}

export function withErrorHandler<T extends unknown[]>(handler: RouteHandler<T>) {
  return withApiErrorHandler(handler, {
    operation: handler.name || "api-handler",
    source: "API",
  });
}
