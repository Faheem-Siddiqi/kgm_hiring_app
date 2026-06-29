import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import { addSubmissionReview, getSubmissionById } from "@/lib/hiring-records";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

async function requireAdminSession() {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return validateAdminSessionToken(getAdminSessionToken(cookieValue));
}

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const { submissionId } = await params;
  const submission = await getSubmissionById(submissionId);

  if (!submission) {
    return NextResponse.json({ message: "Submission was not found." }, { status: 404 });
  }

  return NextResponse.json({ submission });
});

export const PATCH = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const { submissionId } = await params;
  const body = (await request.json()) as {
    remark?: string;
    action?: "evaluated" | "accepted" | "rejected" | "forwarded";
    textScores?: Record<string, number>;
    score?: number;
  };
  const remark = body.remark?.trim() ?? "";

  const submission = await addSubmissionReview({
    submissionId,
    adminId: session.user.id,
    adminName: session.user.name,
    adminEmail: session.user.email,
    remark,
    action: body.action ?? "evaluated",
    textScores: body.textScores,
    score: body.score,
  });

  return NextResponse.json({ submission });
});
