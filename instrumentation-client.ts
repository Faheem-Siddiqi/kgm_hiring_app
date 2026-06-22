import { emitDiagnostic, type ClientDiagnostic } from "@/lib/client-diagnostics";

function describe(error: unknown) {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error, null, 2) };
  } catch {
    return { message: String(error) };
  }
}

function report(
  input: Omit<ClientDiagnostic, "id" | "timestamp" | "url"> & {
    id?: string;
    url?: string;
  },
) {
  const diagnostic: ClientDiagnostic = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    url: input.url ?? window.location.href,
  };
  emitDiagnostic(diagnostic);
}

type ApiErrorPayload = {
  id?: string;
  source?: "API" | "SERVER" | "DATABASE" | "AUTH" | "VALIDATION";
  code?: string;
  message?: string;
  timestamp?: string;
  url?: string;
  context?: Record<string, unknown>;
  causes?: string[];
  stack?: string;
  diagnostic?: ApiDiagnosticPayload;
  mail?: {
    diagnostic?: ApiDiagnosticPayload;
  };
  error?: {
    id?: string;
    code?: string;
    message?: string;
    diagnostics?: {
      name?: string;
      message?: string;
      stack?: string;
      causes?: unknown[];
      context?: unknown;
    };
  };
};

type ApiDiagnosticPayload = Omit<ApiErrorPayload, "diagnostic" | "error">;

function reportApiDiagnostic(
  diagnostic: ApiDiagnosticPayload,
  fallbackTitle: string,
  requestUrl: string,
) {
  report({
    id: diagnostic.id,
    title: fallbackTitle,
    source: diagnostic.source === "SERVER" ? "Server" : "API",
    message: diagnostic.message ?? "The server reported an error.",
    code: diagnostic.code,
    stack: diagnostic.stack,
    causes: diagnostic.causes,
    context: {
      serverSource: diagnostic.source,
      ...diagnostic.context,
    },
    url: diagnostic.url ?? requestUrl,
  });
}

const nativeFetch = window.fetch.bind(window);

window.fetch = async (...args) => {
  const request = args[0];
  const init = args[1];
  const requestUrl =
    typeof request === "string"
      ? request
      : request instanceof URL
        ? request.toString()
        : request.url;

  try {
    const response = await nativeFetch(...args);

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      let payload: ApiErrorPayload | undefined;
      let responseText = "";

      try {
        if (contentType.includes("application/json")) {
          payload = (await response.clone().json()) as ApiErrorPayload;
        } else {
          responseText = (await response.clone().text()).slice(0, 4000);
        }
      } catch {
        responseText = "The error response body could not be read.";
      }

      const flatDiagnostic = payload?.id ? payload : undefined;

      const details = payload?.error?.diagnostics;
      report({
        id: payload?.error?.id,
        title: `HTTP ${response.status} ${response.statusText || "Request failed"}`,
        source: "API",
        message:
          details?.message ??
          payload?.error?.message ??
          flatDiagnostic?.message ??
          responseText ??
          "The API request failed.",
        code: payload?.error?.code ?? flatDiagnostic?.code,
        stack: details?.stack ?? flatDiagnostic?.stack,
        causes: details?.causes ?? flatDiagnostic?.causes,
        context: {
          request: requestUrl,
          method:
            init?.method ??
            (request instanceof Request ? request.method : "GET"),
          status: response.status,
          serverContext: details?.context ?? flatDiagnostic?.context,
        },
      });
    } else if ((response.headers.get("content-type") ?? "").includes("application/json")) {
      try {
        const payload = (await response.clone().json()) as ApiErrorPayload;
        const diagnostic = payload.diagnostic ?? payload.mail?.diagnostic;
        if (diagnostic) {
          reportApiDiagnostic(
            diagnostic,
            "Recoverable server error",
            requestUrl,
          );
        }
      } catch {
        // Successful non-diagnostic JSON responses need no interception.
      }
    }

    return response;
  } catch (error) {
    const described = describe(error);
    report({
      title: "Network request failed",
      source: "Network",
      ...described,
      context: {
        request: requestUrl,
        method:
          init?.method ?? (request instanceof Request ? request.method : "GET"),
      },
    });
    throw error;
  }
};

window.addEventListener("error", (event) => {
  const error = describe(event.error ?? event.message);
  report({
    title: "Uncaught browser error",
    source: "Browser",
    ...error,
    context: { file: event.filename, line: event.lineno, column: event.colno },
  });
});

window.addEventListener("unhandledrejection", (event) => {
  report({ title: "Unhandled promise rejection", source: "Promise", ...describe(event.reason) });
});

export function onRouterTransitionStart(url: string, navigationType: string) {
  if (process.env.NODE_ENV === "development") console.debug(`[navigation] ${navigationType}: ${url}`);
}
