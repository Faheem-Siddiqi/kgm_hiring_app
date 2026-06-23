import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import {
  createJob,
  JobError,
  listJobs,
  parseJobInput,
  updateJobStatus,
} from "@/lib/jobs";
import type { JobStatus } from "@/lib/job-types";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

async function requireAdminSession() {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return validateAdminSessionToken(getAdminSessionToken(cookieValue));
}

export const GET = withErrorHandler(async () => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  return NextResponse.json(await listJobs({ includeInactive: true }));
});

export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  try {
    const job = await createJob(parseJobInput(await request.json()));

    return NextResponse.json({ job });
  } catch (error) {
    const status = error instanceof JobError ? error.status : 400;

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not create job.",
      },
      { status },
    );
  }
});

export const PATCH = withErrorHandler(async (request: Request) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { jobId?: string; status?: JobStatus };

  if (!body.jobId || !body.status) {
    return NextResponse.json(
      { message: "Job and status are required." },
      { status: 400 },
    );
  }

  try {
    const job = await updateJobStatus(body.jobId, body.status);

    return NextResponse.json({ job });
  } catch (error) {
    const status = error instanceof JobError ? error.status : 400;

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not update job.",
      },
      { status },
    );
  }
});
