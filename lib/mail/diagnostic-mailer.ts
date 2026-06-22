import "server-only";

import {
  sendApplicationMail,
  type MailResult,
} from "@/lib/mail/mail-service";

export function sendAdminTestEmail(to: string): Promise<MailResult> {
  return sendApplicationMail({
    to,
    subject: "KGM Hiring email test",
    operation: "send-admin-test-email",
    text: "This is a test email from the KGM Hiring mail service.",
  });
}
