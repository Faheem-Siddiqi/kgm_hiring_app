import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import { sendCandidateInviteEmail } from "@/lib/mail/candidate-mailer";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

type InviteBody = {
  candidateName?: string;
  candidateEmail?: string;
  assessmentTitle?: string;
  otpCode?: string;
  inviteUrl?: string;
};

export const POST = withErrorHandler(async (request: Request) => {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = await validateAdminSessionToken(getAdminSessionToken(cookieValue));

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as InviteBody;
  const candidateName = body.candidateName?.trim();
  const candidateEmail = body.candidateEmail?.trim();
  const assessmentTitle = body.assessmentTitle?.trim();
  const otpCode = body.otpCode?.trim();
  const inviteUrl = body.inviteUrl?.trim();

  if (!candidateName || !candidateEmail || !assessmentTitle || !otpCode || !inviteUrl) {
    return NextResponse.json(
      { message: "Candidate name, email, assessment, OTP, and invite link are required." },
      { status: 400 },
    );
  }

  const mail = await sendCandidateInviteEmail({
    candidateName,
    candidateEmail,
    assessmentTitle,
    otpCode,
    inviteUrl,
  });

  return NextResponse.json({
    mail,
    message: mail.sent
      ? "Candidate invitation email sent."
      : "Invitation email failed. Manual OTP fallback is available.",
  });
});
