import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import {
  getCandidateApplicationById,
  updateCandidateApplicationDecision,
} from "@/lib/job-applications";
import { sendCandidateApplicationRejectionEmail } from "@/lib/mail/candidate-application-rejection-mailer";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

async function requireAdminSession() {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return validateAdminSessionToken(getAdminSessionToken(cookieValue));
}

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const { applicationId } = await params;
  const application = await getCandidateApplicationById(applicationId);

  if (!application) {
    return NextResponse.json(
      { message: "Candidate application was not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ application });
});

export const PATCH = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const { applicationId } = await params;
  const body = (await request.json()) as {
    action?: string;
    mailSent?: boolean;
    mailReason?: string | null;
  };

  if (body.action !== "reject" && body.action !== "invite") {
    return NextResponse.json(
      { message: "Unsupported application action." },
      { status: 400 },
    );
  }

  const application = await getCandidateApplicationById(applicationId);

  if (!application) {
    return NextResponse.json(
      { message: "Candidate application was not found." },
      { status: 404 },
    );
  }

  if (body.action === "invite") {
    const updatedApplication = await updateCandidateApplicationDecision(
      application.id,
      "invited",
      body.mailSent === false ? "failed" : "sent",
      body.mailReason,
    );

    return NextResponse.json({
      application: updatedApplication ?? application,
      message: "Application marked as invited.",
    });
  }

  if (application.decisionStatus === "rejected") {
    return NextResponse.json(
      { message: "This candidate application is already rejected." },
      { status: 409 },
    );
  }

  const mail = await sendCandidateApplicationRejectionEmail({ application });
  const updatedApplication = await updateCandidateApplicationDecision(
    application.id,
    "rejected",
    mail.sent ? "sent" : "failed",
    mail.reason,
  );

  return NextResponse.json({
    application: updatedApplication ?? application,
    mail,
    message: mail.sent
      ? "Rejection email sent to the candidate."
      : "Application marked rejected, but the rejection email failed.",
  });
});
