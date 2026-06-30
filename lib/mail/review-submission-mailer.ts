import "server-only";

import { sendApplicationMail } from "@/lib/mail/mail-service";

export async function sendReviewSubmissionEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  return sendApplicationMail({
    to,
    subject,
    text: body,
    operation: "send-candidate-submission-email",
  });
}
