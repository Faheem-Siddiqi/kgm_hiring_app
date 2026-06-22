import { NextResponse } from "next/server";
import {
  findAdminInvitationManagerByEmail,
  getAdminAccessRequestState,
} from "@/lib/admin-users";
import { sendAdminAccessRequestEmail } from "@/lib/mail/admin-mailer";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }

  return baseUrl.replace(/\/$/, "");
}

function getRequestStateLabel(status: string) {
  switch (status) {
    case "active":
      return "Existing active admin account";
    case "paused":
      return "Existing admin account is paused";
    case "pending":
      return "Pending first-time setup invitation";
    case "expired-pending":
      return "Pending invitation appears expired";
    default:
      return "No matching admin account found";
  }
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as {
    adminEmail?: string;
    requesterEmail?: string;
    note?: string;
  };
  const adminEmail = body.adminEmail?.trim() ?? "";
  const requesterEmail = body.requesterEmail?.trim() ?? "";
  const note = body.note?.trim().slice(0, 800) ?? "";

  if (!adminEmail) {
    return NextResponse.json(
      { message: "Enter the email address of the admin who can approve access." },
      { status: 400 },
    );
  }

  if (!isValidEmail(adminEmail)) {
    return NextResponse.json(
      { message: "Enter a valid admin email address." },
      { status: 400 },
    );
  }

  if (!requesterEmail) {
    return NextResponse.json(
      { message: "Enter the email address that needs admin access." },
      { status: 400 },
    );
  }

  if (!isValidEmail(requesterEmail)) {
    return NextResponse.json(
      { message: "Enter a valid email address for the person requesting access." },
      { status: 400 },
    );
  }

  const [reviewer, requestState] = await Promise.all([
    findAdminInvitationManagerByEmail(adminEmail),
    getAdminAccessRequestState(requesterEmail),
  ]);

  if (!reviewer) {
    return NextResponse.json(
      {
        message:
          "Invalid admin email. Use an active main-admin email that is allowed to add sub-admins.",
      },
      { status: 403 },
    );
  }

  const mail = await sendAdminAccessRequestEmail({
    requesterEmail,
    reviewer,
    requesterNote: note,
    adminSettingsUrl: `${getBaseUrl()}/admin/settings`,
    requestState: getRequestStateLabel(requestState.status),
  });

  return NextResponse.json({
    ok: true,
    mail,
    message: mail.sent
      ? "Your access request was sent to the selected admin for review."
      : (mail.reason ??
        "Your request was prepared, but the review email could not be sent."),
  });
});
