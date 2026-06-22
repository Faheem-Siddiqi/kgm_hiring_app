import "server-only";

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import {
  getDevErrorDiagnostic,
  logServerError,
  type DevErrorDiagnostic,
} from "@/lib/server-error";

export type MailResult = {
  sent: boolean;
  reason: string | null;
  code?: string;
  diagnostic?: DevErrorDiagnostic;
};

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  operation: string;
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

function getFriendlyMailError(error: unknown): Omit<MailResult, "diagnostic"> {
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
        "Gmail rejected the SMTP login. Use the full Gmail address in ADMIN_MAIL_USER and a Google app password in ADMIN_MAIL_PASSWORD, then restart the server.",
    };
  }

  return {
    sent: false,
    reason: error instanceof Error ? error.message : "Could not send email.",
  };
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

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendApplicationMail({
  to,
  subject,
  text,
  html,
  operation,
}: MailInput): Promise<MailResult> {
  const config = getMailConfig();

  if (!config) {
    const reason = "Email SMTP settings are not configured.";
    const diagnostic = reportMailFailure(new Error(reason), operation);
    return { sent: false, reason, diagnostic };
  }

  try {
    transporter ??= nodemailer.createTransport(config);
    await transporter.sendMail({
      from: getFromAddress(config),
      to,
      subject,
      text,
      html,
    });

    return { sent: true, reason: null };
  } catch (error) {
    const result = getFriendlyMailError(error);
    const diagnostic = reportMailFailure(error, operation, {
      recipient: to,
      mailCode: result.code,
    });
    return { ...result, diagnostic };
  }
}
