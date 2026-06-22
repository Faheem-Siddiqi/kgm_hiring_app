import { getDatabaseConnectionDetails } from "@/db";
import { AppError } from "@/src/lib/errors/app-error";
import { withApiErrorHandler } from "@/src/lib/errors/error-handler";
import { isDevMode } from "@/src/lib/logger";

export const runtime = "nodejs";

export const GET = withApiErrorHandler(async () => {
  if (!isDevMode()) {
    throw new AppError("Database diagnostics are disabled.", {
      status: 404,
      code: "NOT_FOUND",
      source: "DATABASE",
    });
  }

  return Response.json(await getDatabaseConnectionDetails());
}, {
  operation: "database-status",
  source: "DATABASE",
});
