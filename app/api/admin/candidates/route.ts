import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { canViewCandidateInviteOtp, validateAdminSessionToken } from "@/lib/admin-users";
import {
  createAssessmentCandidate,
  type PublicCandidateRecord,
  updateCandidateInviteStatus,
} from "@/lib/hiring-records";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

async function requireAdminSession() {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return validateAdminSessionToken(getAdminSessionToken(cookieValue));
}

function serializeCandidateForAdmin(
  candidate: PublicCandidateRecord | null,
  canViewOtp: boolean,
) {
  if (!candidate) return null;

  return {
    ...candidate,
    canViewOtp,
    otpCode: canViewOtp ? candidate.otpCode : "******",
  };
}

export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    assessmentId?: string;
    jobId?: string;
    inviteExpiresAt?: string;
  };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const assessmentId = body.assessmentId?.trim() ?? "";
  const jobId = body.jobId?.trim() ?? "";
  const inviteExpiresAt = body.inviteExpiresAt?.trim();

  if (!name || !email || (!assessmentId && !jobId)) {
    return NextResponse.json(
      { message: "Candidate name, email, and assessment or job are required." },
      { status: 400 },
    );
  }

  const result = await createAssessmentCandidate({
    name,
    email,
    assessmentId,
    jobId,
    inviteExpiresAt,
  });
  const canViewOtp = canViewCandidateInviteOtp(session.user);

  return NextResponse.json({
    ...result,
    candidate: serializeCandidateForAdmin(result.candidate, canViewOtp),
    canViewCandidateOtp: canViewOtp,
  });
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
    candidateId?: string;
    status?: "pending" | "sent" | "failed";
    failure?: string | null;
  };

  if (!body.candidateId || !body.status) {
    return NextResponse.json(
      { message: "Candidate and invite status are required." },
      { status: 400 },
    );
  }

  const candidate = await updateCandidateInviteStatus(
    body.candidateId,
    body.status,
    body.failure,
  );
  const canViewOtp = canViewCandidateInviteOtp(session.user);

  return NextResponse.json({
    candidate: serializeCandidateForAdmin(candidate, canViewOtp),
    canViewCandidateOtp: canViewOtp,
  });
});
