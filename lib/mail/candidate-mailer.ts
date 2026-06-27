import "server-only";

import { sendApplicationMail, type MailResult } from "@/lib/mail/mail-service";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sendCandidateInviteEmail({
  candidateName,
  candidateEmail,
  assessmentTitle,
  otpCode,
  inviteUrl,
}: {
  candidateName: string;
  candidateEmail: string;
  assessmentTitle: string;
  otpCode: string;
  inviteUrl: string;
}): Promise<MailResult> {
  const safeName = escapeHtml(candidateName);
  const safeAssessmentTitle = escapeHtml(assessmentTitle);
  const safeOtpCode = escapeHtml(otpCode);
  const safeInviteUrl = escapeHtml(inviteUrl);

  return sendApplicationMail({
    to: candidateEmail,
    subject: `KGM assessment invitation - ${assessmentTitle}`,
    operation: "send-candidate-assessment-invite",
    text: [
      `Dear ${candidateName},`,
      "",
      `You have been invited to complete the ${assessmentTitle}.`,
      `Assessment OTP: ${otpCode}`,
      "",
      "Open the candidate portal using the link below:",
      inviteUrl,
      "",
      "KGM Hiring Team",
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>KGM Assessment Invitation</title>
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
                        Assessment Invitation
                      </h1>
                      <p style="margin:10px 0 0; font-size:14px; line-height:1.6; color:#94a3b8;">
                        You have been invited to complete an assessment.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:34px;">
                      <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#111827;">
                        Dear <strong>${safeName}</strong>,
                      </p>
                      <p style="margin:0 0 22px; font-size:15px; line-height:1.7; color:#374151;">
                        Please complete the <strong>${safeAssessmentTitle}</strong> assessment using the secure candidate portal.
                      </p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0; background:#f9fafb; border:1px solid #e5e7eb; border-radius:14px;">
                        <tr>
                          <td style="padding:16px 18px;">
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Assessment OTP</div>
                            <div style="font-size:22px; letter-spacing:0.16em; color:#111827; font-weight:700;">${safeOtpCode}</div>
                          </td>
                        </tr>
                      </table>
                      <div style="text-align:center; margin:30px 0;">
                        <a href="${safeInviteUrl}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:12px; font-size:15px; font-weight:700;">
                          Open Assessment
                        </a>
                      </div>
                      <p style="margin:22px 0 0; font-size:13px; line-height:1.7; color:#6b7280;">
                        If the button does not work, copy and paste this link into your browser:
                      </p>
                      <p style="margin:8px 0 0; font-size:13px; line-height:1.6; word-break:break-all;">
                        <a href="${safeInviteUrl}" style="color:#2563eb; text-decoration:underline;">${safeInviteUrl}</a>
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
