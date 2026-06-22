import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendAdminTestEmail } from "@/lib/admin-mailer";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

export const POST = withErrorHandler(async () => {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = await validateAdminSessionToken(getAdminSessionToken(cookieValue));

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const to = process.env.ADMIN_MAIL_TEST_TO || session.user.email;
  const mail = await sendAdminTestEmail(to);

  return NextResponse.json({ mail, to });
});
