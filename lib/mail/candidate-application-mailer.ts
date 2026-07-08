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

function parseRecipientEmails(value?: string | null) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  );
}

export function sendCandidateApplicationEmail({
  application,
  submissionUrl,
}: {
  application: PublicCandidateApplication;
  submissionUrl: string;
}): Promise<MailResult> {
  const adminEmails = parseRecipientEmails(
    process.env.CANDIDATE_APPLICATION_ADMIN_EMAILS,
  );
  const fallbackEmails = parseRecipientEmails(
    process.env.ADMIN_EMAIL || process.env.ADMIN_MAIL_USER,
  );
  const recipients = adminEmails.length ? adminEmails : fallbackEmails;

  if (!recipients.length) {
    return Promise.resolve({
      sent: false,
      reason: "Admin notification email is not configured.",
    });
  }

  const safeName = escapeHtml(application.candidateName);
  const safeEmail = escapeHtml(application.candidateEmail);
  const safeJobTitle = escapeHtml(application.jobTitle);
  const safeCvUrl = escapeHtml(application.cvUrl);
  const safeAvailability = escapeHtml(application.availability);
  const safeSubmissionUrl = escapeHtml(submissionUrl);

  return sendApplicationMail({
    to: recipients.join(", "),
    subject: `New job application - ${application.jobTitle}`,
    operation: "send-candidate-application-notification",
    text: [
      "A candidate submitted a job application.",
      "",
      `Candidate: ${application.candidateName}`,
      `Email: ${application.candidateEmail}`,
      `Job: ${application.jobTitle}`,
      `CV link: ${application.cvUrl}`,
      `Availability: ${application.availability}`,
      "",
      "Open the protected admin application review page:",
      submissionUrl,
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>New Job Application</title>
        </head>
        <body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#111827;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8; padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden;">
                  <tr>
                    <td style="background:#020617; padding:30px 34px;">
                      <div style="display:inline-block; padding:6px 10px; border:1px solid rgba(255,255,255,0.16); border-radius:999px; color:#cbd5e1; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">
                        KGM Hiring
                      </div>
                      <h1 style="margin:18px 0 0; font-size:26px; line-height:1.25; color:#ffffff; font-weight:700;">
                        New Job Application
                      </h1>
                      <p style="margin:10px 0 0; font-size:14px; line-height:1.6; color:#94a3b8;">
                        A candidate submitted details for an open role.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:34px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:14px;">
                        <tr>
                          <td style="padding:16px 18px;">
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Candidate</div>
                            <div style="font-size:16px; color:#111827; font-weight:700; margin-bottom:16px;">${safeName}</div>
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Email</div>
                            <div style="font-size:15px; color:#111827; margin-bottom:16px;">${safeEmail}</div>
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Job</div>
                            <div style="font-size:16px; color:#111827; font-weight:700; margin-bottom:16px;">${safeJobTitle}</div>
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">CV link</div>
                            <div style="font-size:14px; line-height:1.6; word-break:break-all; margin-bottom:16px;">
                              <a href="${safeCvUrl}" style="color:#2563eb; text-decoration:underline;">${safeCvUrl}</a>
                            </div>
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Availability</div>
                            <div style="font-size:15px; line-height:1.6; color:#111827;">${safeAvailability}</div>
                          </td>
                        </tr>
                      </table>
                      <div style="text-align:center; margin:30px 0;">
                        <a href="${safeSubmissionUrl}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:12px; font-size:15px; font-weight:700;">
                          Review Candidate Application
                        </a>
                      </div>
                      <p style="margin:22px 0 0; font-size:13px; line-height:1.7; color:#6b7280;">
                        If the button does not work, copy and paste this link into your browser:
                      </p>
                      <p style="margin:8px 0 0; font-size:13px; line-height:1.6; word-break:break-all;">
                        <a href="${safeSubmissionUrl}" style="color:#2563eb; text-decoration:underline;">${safeSubmissionUrl}</a>
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
