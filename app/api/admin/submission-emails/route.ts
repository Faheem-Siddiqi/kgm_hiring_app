import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import { sendReviewSubmissionEmail } from "@/lib/mail/review-submission-mailer";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

type SubmissionEmailBody = {
  to?: string;
  subject?: string;
  body?: string;
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

  const input = (await request.json()) as SubmissionEmailBody;
  const to = input.to?.trim();
  const subject = input.subject?.trim();
  const body = input.body?.trim();

  if (!to || !subject || !body) {
    return NextResponse.json(
      { message: "Recipient, subject, and email body are required." },
      { status: 400 },
    );
  }

  const mail = await sendReviewSubmissionEmail({
    to,
    subject,
    body,
  });

  return NextResponse.json({
    mail,
    message: mail.sent ? "Email sent." : "Email could not be sent.",
  });
});
