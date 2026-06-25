import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import {
  AssessmentError,
  createAssessment,
  listAssessments,
  parseAssessmentInput,
  updateAssessment,
} from "@/lib/assessments";
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

  return NextResponse.json(await listAssessments());
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
    const assessment = await createAssessment(
      await parseAssessmentInput(await request.json()),
    );

    return NextResponse.json({ assessment });
  } catch (error) {
    const status = error instanceof AssessmentError ? error.status : 400;

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not create assessment.",
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

  const body = (await request.json()) as {
    assessmentId?: string;
    name?: unknown;
    description?: unknown;
    questionBankId?: unknown;
    sectionSettings?: unknown;
  };

  if (!body.assessmentId) {
    return NextResponse.json(
      { message: "Assessment is required." },
      { status: 400 },
    );
  }

  try {
    const assessment = await updateAssessment(
      body.assessmentId,
      await parseAssessmentInput(body),
    );

    return NextResponse.json({ assessment });
  } catch (error) {
    const status = error instanceof AssessmentError ? error.status : 400;

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not update assessment.",
      },
      { status },
    );
  }
});
