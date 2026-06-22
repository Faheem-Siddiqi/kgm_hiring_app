import type { Instrumentation } from "next";

export async function register() {
  return;
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const { logServerError } = await import("@/lib/server-error");
  logServerError(error, {
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
  });
};
