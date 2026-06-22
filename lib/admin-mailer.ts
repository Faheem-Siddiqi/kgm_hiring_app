import "server-only";

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { PublicAdminUser } from "@/lib/admin-users";
import {
  getDevErrorDiagnostic,
  logServerError,
  type DevErrorDiagnostic,
} from "@/lib/server-error";

type AdminInviteMailInput = {
  user: PublicAdminUser;
  setupUrl: string;
};

type PasswordResetMailInput = {
  user: PublicAdminUser;
  resetUrl: string;
};

type MailResult = {
  sent: boolean;
  reason: string | null;
  code?: string;
  diagnostic?: DevErrorDiagnostic;
};

function reportMailFailure(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>,
) {
  const report = logServerError(error, {
    operation,
    service: "nodemailer",
    ...context,
  });

  return getDevErrorDiagnostic(report);
}

function missingMailConfig(operation: string): MailResult {
  const reason = "Email SMTP settings are not configured.";
  const diagnostic = reportMailFailure(new Error(reason), operation);
  return { sent: false, reason, diagnostic };
}

// Required in .env for Gmail SMTP:
// ADMIN_MAIL_HOST=smtp.gmail.com
// ADMIN_MAIL_PORT=587
// ADMIN_MAIL_SECURE=false
// ADMIN_MAIL_USER=your-gmail-address@gmail.com
// ADMIN_MAIL_PASSWORD=your-google-app-password
// ADMIN_MAIL_FROM="KGM Hiring <your-gmail-address@gmail.com>"
// APP_BASE_URL=http://localhost:3000
function getMailConfig(): SMTPTransport.Options | null {
  const host = process.env.ADMIN_MAIL_HOST?.trim();
  const port = Number(process.env.ADMIN_MAIL_PORT || 587);
  const user = process.env.ADMIN_MAIL_USER?.trim();
  const pass = process.env.ADMIN_MAIL_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.ADMIN_MAIL_SECURE === "true",
    auth: { user, pass },
  };
}

function getFriendlyMailError(error: unknown): MailResult {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EAUTH"
  ) {
    return {
      sent: false,
      code: "EAUTH",
      reason:
        "Gmail rejected the SMTP login. Use the full Gmail address in ADMIN_MAIL_USER and a Google app password in ADMIN_MAIL_PASSWORD, then restart the dev server.",
    };
  }

  const message =
    error instanceof Error ? error.message : "Could not send email.";

  return { sent: false, reason: message };
}

function getFromAddress(config: SMTPTransport.Options) {
  if (process.env.ADMIN_MAIL_FROM?.trim()) {
    return process.env.ADMIN_MAIL_FROM.trim();
  }

  const auth = config.auth;

  if (auth && "user" in auth && typeof auth.user === "string") {
    return auth.user;
  }

  return "KGM Hiring <no-reply@kgm.local>";
}

async function sendMail(
  config: SMTPTransport.Options,
  options: {
    from: string;
    to: string;
    subject: string;
    text: string;
  },
  operation: string,
): Promise<MailResult> {
  try {
    const transporter = nodemailer.createTransport(config);
    await transporter.sendMail(options);

    return { sent: true, reason: null };
  } catch (error) {
    const result = getFriendlyMailError(error);
    const diagnostic = reportMailFailure(error, operation, {
      recipient: options.to,
      mailCode: result.code,
    });
    return { ...result, diagnostic };
  }
}

export async function sendAdminInviteEmail({
  user,
  setupUrl,
}: AdminInviteMailInput): Promise<MailResult> {
  const config = getMailConfig();

  if (!config) {
    return missingMailConfig("send-admin-invitation-email");
  }

  const from = getFromAddress(config);

  return sendMail(config, {
    from,
    to: user.email,
    subject: "KGM Hiring admin access",
    text: [
      `Dear ${user.name},`,
      "",
      "Your KGM Hiring admin account has been created.",
      `Designation: ${user.designation}`,
      `Email: ${user.email}`,
      "",
      "Use the link below to set your password before signing in.",
      setupUrl,
      "",
      "This setup link expires in 20 minutes.",
      "",
      "If the link expires, request a password reset from the admin login page.",
      "",
      "KGM Hiring Team",
    ].join("\n"),
  }, "send-admin-invitation-email");
}

export async function sendPasswordResetEmail({
  user,
  resetUrl,
}: PasswordResetMailInput): Promise<MailResult> {
  const config = getMailConfig();

  if (!config) {
    return missingMailConfig("send-password-reset-email");
  }

  const from = getFromAddress(config);

  return sendMail(config, {
    from,
    to: user.email,
    subject: "Reset your KGM Hiring admin password",
    text: [
      `Dear ${user.name},`,
      "",
      "Use the link below to reset your KGM Hiring admin password.",
      resetUrl,
      "",
      "This link expires in 20 minutes. If you did not request it, ignore this email.",
      "",
      "KGM Hiring Team",
    ].join("\n"),
  }, "send-password-reset-email");
}

export async function sendAdminTestEmail(to: string): Promise<MailResult> {
  const config = getMailConfig();

  if (!config) {
    return missingMailConfig("send-admin-test-email");
  }

  const from = getFromAddress(config);

  return sendMail(config, {
    from,
    to,
    subject: "KGM Hiring email test",
    text: "This is a test email from the KGM Hiring admin mailer.",
  }, "send-admin-test-email");
}
