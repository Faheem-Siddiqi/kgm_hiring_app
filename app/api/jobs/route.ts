import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

export const GET = withErrorHandler(async () => {
  const result = await listJobs();

  return NextResponse.json(result);
});
