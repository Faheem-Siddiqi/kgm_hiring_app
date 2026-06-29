import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import { getCandidateInviteById } from "@/lib/hiring-records";
import { sendCandidateInviteEmail } from "@/lib/mail/candidate-mailer";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

type InviteBody = {
  candidateId?: string;
  candidateName?: string;
  candidateEmail?: string;
  assessmentTitle?: string;
  otpCode?: string;
  inviteUrl?: string;
};

function buildInviteUrl(request: Request, otpCode: string) {
  const fallbackOrigin = new URL(request.url).origin;
  const appOrigin = process.env.APP_BASE_URL?.trim() || fallbackOrigin;
  return `${appOrigin.replace(/\/$/, "")}/?otp=${encodeURIComponent(otpCode)}`;
}

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
  const candidateId = body.candidateId?.trim();

  if (candidateId) {
    const invite = await getCandidateInviteById(candidateId);

    if (!invite) {
      return NextResponse.json(
        { message: "Candidate invitation is no longer active." },
        { status: 404 },
      );
    }

    const mail = await sendCandidateInviteEmail({
      candidateName: invite.candidate.name,
      candidateEmail: invite.candidate.email,
      assessmentTitle: body.assessmentTitle?.trim() || invite.assessment.name,
      otpCode: invite.candidate.otpCode,
      inviteUrl: buildInviteUrl(request, invite.candidate.otpCode),
    });

    return NextResponse.json({
      mail,
      message: mail.sent
        ? "Candidate invitation email sent."
        : "Invitation email failed. Manual OTP fallback is available.",
    });
  }

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
