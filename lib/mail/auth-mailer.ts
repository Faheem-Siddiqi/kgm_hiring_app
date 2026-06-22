import "server-only";

import type { PublicAdminUser } from "@/lib/admin-users";
import {
  sendApplicationMail,
  type MailResult,
} from "@/lib/mail/mail-service";

export function sendPasswordResetEmail({
  user,
  resetUrl,
}: {
  user: PublicAdminUser;
  resetUrl: string;
}): Promise<MailResult> {
  return sendApplicationMail({
    to: user.email,
    subject: "Reset your KGM Hiring password",
    operation: "send-password-reset-email",
    text: [
      `Dear ${user.name},`,
      "",
      "We received a request to reset your KGM Hiring password.",
      "Use the secure link below to choose a new password.",
      resetUrl,
      "",
      "This link expires in 20 minutes. After expiry, its stored token is removed when validated.",
      "If you did not request this change, you can safely ignore this email.",
      "",
      "KGM Hiring Team",
    ].join("\n"),
  });
}
