export const ERROR_SOURCES = [
  "API",
  "SERVER",
  "DATABASE",
  "AUTH",
  "VALIDATION",
] as const;

export type ErrorSource = (typeof ERROR_SOURCES)[number];

export type AppErrorOptions = {
  status?: number;
  code?: string;
  source?: ErrorSource;
  safeMessage?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly status: number;
  readonly statusCode: number;
  readonly code: string;
  readonly source: ErrorSource;
  readonly safeMessage: string;
  readonly context?: Record<string, unknown>;

  constructor(message: string, options?: AppErrorOptions);
  constructor(message: string, status?: number, code?: string, options?: ErrorOptions);
  constructor(
    message: string,
    optionsOrStatus: AppErrorOptions | number = {},
    legacyCode = "INTERNAL_ERROR",
    legacyOptions?: ErrorOptions,
  ) {
    const options =
      typeof optionsOrStatus === "number"
        ? { status: optionsOrStatus, code: legacyCode, cause: legacyOptions?.cause }
        : optionsOrStatus;

    super(message, { cause: options.cause });
    this.name = "AppError";
    this.status = options.status ?? 500;
    this.statusCode = this.status;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.source = options.source ?? "SERVER";
    this.safeMessage = options.safeMessage ?? message;
    this.context = options.context;
  }
}
