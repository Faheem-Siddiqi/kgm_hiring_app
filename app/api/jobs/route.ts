import { NextResponse } from "next/server";
import { listJobs, parsePaginationParams } from "@/lib/jobs";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

export const GET = withErrorHandler(async (request: Request) => {
  const result = await listJobs(
    parsePaginationParams(new URL(request.url).searchParams),
  );

  return NextResponse.json(result);
});
