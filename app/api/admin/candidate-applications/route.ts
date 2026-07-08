import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import { listCandidateApplications } from "@/lib/job-applications";
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

  const applications = await listCandidateApplications();
  return NextResponse.json({ applications });
});
