import "server-only";

import { sendApplicationMail, type MailResult } from "@/lib/mail/mail-service";
import type { PublicCandidateApplication } from "@/lib/job-applications";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sendCandidateApplicationRejectionEmail({
  application,
}: {
  application: PublicCandidateApplication;
}): Promise<MailResult> {
  const safeName = escapeHtml(application.candidateName);
  const safeJobTitle = escapeHtml(application.jobTitle);

  return sendApplicationMail({
    to: application.candidateEmail,
    subject: `Application update - ${application.jobTitle}`,
    operation: "send-candidate-application-rejection",
    text: [
      `Dear ${application.candidateName},`,
      "",
      `Thank you for applying for the ${application.jobTitle} role at KGM.`,
      "After reviewing your application, we will not be moving forward with your profile for this opening.",
      "",
      "We appreciate the time you took to apply and wish you the best in your job search.",
      "",
      "Regards,",
      "KGM Hiring Team",
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Application Update</title>
        </head>
        <body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#111827;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8; padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden;">
                  <tr>
                    <td style="background:#111827; padding:30px 34px;">
                      <div style="display:inline-block; padding:6px 10px; border:1px solid rgba(255,255,255,0.16); border-radius:999px; color:#cbd5e1; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">
                        KGM Hiring
                      </div>
                      <h1 style="margin:18px 0 0; font-size:26px; line-height:1.25; color:#ffffff; font-weight:700;">
                        Application Update
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:34px;">
                      <p style="margin:0; font-size:15px; line-height:1.7;">Dear ${safeName},</p>
                      <p style="margin:18px 0 0; font-size:15px; line-height:1.7;">
                        Thank you for applying for the <strong>${safeJobTitle}</strong> role at KGM.
                      </p>
                      <p style="margin:18px 0 0; font-size:15px; line-height:1.7;">
                        After reviewing your application, we will not be moving forward with your profile for this opening.
                      </p>
                      <p style="margin:18px 0 0; font-size:15px; line-height:1.7; color:#4b5563;">
                        We appreciate the time you took to apply and wish you the best in your job search.
                      </p>
                      <p style="margin:24px 0 0; font-size:15px; line-height:1.7;">
                        Regards,<br />KGM Hiring Team
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}
