import "server-only";

import type { PublicAdminUser } from "@/lib/admin-users";
import { ADMIN_INVITATION_EXPIRY_DAYS } from "@/lib/admin-constants";
import {
  sendApplicationMail,
  type MailResult,
} from "@/lib/mail/mail-service";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sendAdminInviteEmail({
  user,
  setupUrl,
}: {
  user: PublicAdminUser;
  setupUrl: string;
}): Promise<MailResult> {
  const safeName = escapeHtml(user.name);
  const safeEmail = escapeHtml(user.email);
  const safeSetupUrl = escapeHtml(setupUrl);

  return sendApplicationMail({
    to: user.email,
    subject: "KGM Hiring admin access invitation",
    operation: "send-admin-invitation-email",

    text: [
      `Dear ${user.name},`,
      "",
      "Your KGM Hiring admin account has been created.",
      `Email: ${user.email}`,
      "",
      "Use the link below to set your password before signing in.",
      setupUrl,
      "",
      `This secure first-time setup link expires in ${ADMIN_INVITATION_EXPIRY_DAYS} days.`,
      "",
      "If the link expires before setup is completed, this pending account will be removed. An administrator must add you again to issue a new invitation.",
      "",
      "KGM Hiring Team",
    ].join("\n"),

    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>KGM Hiring Admin Invitation</title>
        </head>

        <body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#111827;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8; padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; box-shadow:0 18px 45px rgba(15,23,42,0.10);">

                  <tr>
                    <td style="background:#020617; padding:30px 34px;">
                      <div style="display:inline-block; padding:6px 10px; border:1px solid rgba(255,255,255,0.16); border-radius:999px; color:#cbd5e1; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">
                        KGM Hiring
                      </div>

                      <h1 style="margin:18px 0 0; font-size:26px; line-height:1.25; color:#ffffff; font-weight:700;">
                        Admin Access Invitation
                      </h1>

                      <p style="margin:10px 0 0; font-size:14px; line-height:1.6; color:#94a3b8;">
                        You have been invited to set up your admin account.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:34px;">
                      <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#111827;">
                        Dear <strong>${safeName}</strong>,
                      </p>

                      <p style="margin:0 0 22px; font-size:15px; line-height:1.7; color:#374151;">
                        Your KGM Hiring admin account has been created. Please set your password using the secure button below before signing in.
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0; background:#f9fafb; border:1px solid #e5e7eb; border-radius:14px;">
                        <tr>
                          <td style="padding:16px 18px;">
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">
                              Account Email
                            </div>
                            <div style="font-size:15px; color:#111827; font-weight:700;">
                              ${safeEmail}
                            </div>
                          </td>
                        </tr>
                      </table>

                      <div style="text-align:center; margin:30px 0;">
                        <a href="${safeSetupUrl}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:12px; font-size:15px; font-weight:700;">
                          Set Password
                        </a>
                      </div>

                      <div style="margin:24px 0; padding:16px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;">
                        <p style="margin:0; font-size:14px; line-height:1.7; color:#334155;">
                          This secure first-time setup link expires in <strong>${ADMIN_INVITATION_EXPIRY_DAYS} days</strong>.
                        </p>
                      </div>

                      <div style="margin:22px 0; padding:16px 18px; background:#fff7ed; border:1px solid #fed7aa; border-radius:14px;">
                        <p style="margin:0; font-size:13px; line-height:1.7; color:#9a3412;">
                          If the link expires before setup is completed, this pending account will be removed. An administrator must add you again to issue a new invitation.
                        </p>
                      </div>

                      <p style="margin:24px 0 0; font-size:13px; line-height:1.7; color:#6b7280;">
                        If the button does not work, copy and paste this link into your browser:
                      </p>

                      <p style="margin:8px 0 0; font-size:13px; line-height:1.6; word-break:break-all;">
                        <a href="${safeSetupUrl}" style="color:#2563eb; text-decoration:underline;">
                          ${safeSetupUrl}
                        </a>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px 34px; background:#f9fafb; border-top:1px solid #e5e7eb;">
                      <p style="margin:0; font-size:13px; line-height:1.7; color:#6b7280;">
                        Regards,<br />
                        <strong style="color:#111827;">KGM Hiring Team</strong>
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

export function sendAdminAccessRequestEmail({
  requesterEmail,
  reviewer,
  requesterNote,
  adminSettingsUrl,
  requestState,
}: {
  requesterEmail: string;
  reviewer: PublicAdminUser;
  requesterNote?: string;
  adminSettingsUrl: string;
  requestState: string;
}): Promise<MailResult> {
  const safeRequesterEmail = escapeHtml(requesterEmail);
  const safeReviewerName = escapeHtml(reviewer.name);
  const safeRequesterNote = requesterNote ? escapeHtml(requesterNote) : "";
  const safeAdminSettingsUrl = escapeHtml(adminSettingsUrl);

  return sendApplicationMail({
    to: reviewer.email,
    subject: "KGM Hiring admin access request",
    operation: "send-admin-access-request-email",
    text: [
      `Hello ${reviewer.name},`,
      "",
      `${requesterEmail} requested a KGM Hiring admin access invitation.`,
      `Current account state: ${requestState}`,
      "",
      requesterNote ? `Request note: ${requesterNote}` : "",
      "",
      "Please review this request in Admin Settings. If the person should have access, add them as a sub-admin or create a fresh invitation from the admin access screen.",
      adminSettingsUrl,
      "",
      "This email is only a review request. No setup link was generated from the public request page.",
      "",
      "KGM Hiring Team",
    ].filter(Boolean).join("\n"),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>KGM Hiring Admin Access Request</title>
        </head>
        <body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#111827;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8; padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; box-shadow:0 18px 45px rgba(15,23,42,0.10);">
                  <tr>
                    <td style="background:#020617; padding:30px 34px;">
                      <div style="display:inline-block; padding:6px 10px; border:1px solid rgba(255,255,255,0.16); border-radius:999px; color:#cbd5e1; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">
                        KGM Hiring
                      </div>
                      <h1 style="margin:18px 0 0; font-size:26px; line-height:1.25; color:#ffffff; font-weight:700;">
                        Admin Access Request
                      </h1>
                      <p style="margin:10px 0 0; font-size:14px; line-height:1.6; color:#94a3b8;">
                        A user asked you to review an admin access invitation.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:34px;">
                      <p style="margin:0 0 18px; font-size:15px; line-height:1.7; color:#374151;">
                        Hello <strong>${safeReviewerName}</strong>,
                      </p>
                      <p style="margin:0 0 18px; font-size:15px; line-height:1.7; color:#374151;">
                        <strong>${safeRequesterEmail}</strong> requested access to the KGM Hiring admin workspace.
                      </p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0; background:#f9fafb; border:1px solid #e5e7eb; border-radius:14px;">
                        <tr>
                          <td style="padding:16px 18px;">
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Account state</div>
                            <div style="font-size:15px; color:#111827; font-weight:700;">${escapeHtml(requestState)}</div>
                          </td>
                        </tr>
                      </table>
                      ${safeRequesterNote ? `
                        <div style="margin:22px 0; padding:16px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;">
                          <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Request note</div>
                          <p style="margin:0; font-size:14px; line-height:1.7; color:#334155;">${safeRequesterNote}</p>
                        </div>
                      ` : ""}
                      <p style="margin:0 0 22px; font-size:14px; line-height:1.7; color:#374151;">
                        Please review this request in Admin Settings. If the person should have access, add them as a sub-admin or issue a fresh first-time setup invitation.
                      </p>
                      <div style="text-align:center; margin:30px 0;">
                        <a href="${safeAdminSettingsUrl}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:12px; font-size:15px; font-weight:700;">
                          Open Admin Settings
                        </a>
                      </div>
                      <p style="margin:22px 0 0; font-size:13px; line-height:1.7; color:#6b7280;">
                        This email is only a review request. No setup link was generated from the public request page.
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
