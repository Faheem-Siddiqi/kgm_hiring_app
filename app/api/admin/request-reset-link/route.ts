import { NextResponse } from "next/server";
import { createPasswordReset } from "@/lib/admin-users";
import { sendPasswordResetEmail } from "@/lib/mail/auth-mailer";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

function getBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }

  return baseUrl.replace(/\/$/, "");
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim() ?? "";

  if (!email) {
    return NextResponse.json(
      { message: "Enter the admin email address registered for this workspace." },
      { status: 400 },
    );
  }

  const reset = await createPasswordReset(email);

  if (!reset) {
    return NextResponse.json({
      ok: true,
      message:
        "If this active admin email exists, a password reset link has been sent.",
    });
  }

  const resetUrl = `${getBaseUrl()}/admin/reset-password?token=${encodeURIComponent(reset.token)}`;
  const mail = await sendPasswordResetEmail({ user: reset.user, resetUrl });

  return NextResponse.json({
    ok: true,
    mail,
    message: mail.sent
      ? "Password reset email sent to the registered admin email."
      : (mail.reason ?? "Reset link created, but email could not be sent."),
  });
});
