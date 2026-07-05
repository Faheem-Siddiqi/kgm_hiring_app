import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { canViewCandidateInviteOtp, validateAdminSessionToken } from "@/lib/admin-users";
import { listHiringAnalyticsRecords, listHiringRecords } from "@/lib/hiring-records";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

async function requireAdminSession() {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return validateAdminSessionToken(getAdminSessionToken(cookieValue));
}

export const GET = withErrorHandler(async (request: Request) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const canViewOtp = canViewCandidateInviteOtp(session.user);
  const view = new URL(request.url).searchParams.get("view");
  const records = view === "analytics"
    ? await listHiringAnalyticsRecords()
    : await listHiringRecords();

  return NextResponse.json({
    ...records,
    canViewCandidateOtp: canViewOtp,
    candidates: records.candidates.map((candidate) => ({
      ...candidate,
      canViewOtp,
      otpCode: canViewOtp ? candidate.otpCode : "******",
    })),
  });
});
