import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AdminUserError,
  canManageAdminUsers,
  canModerateAdminUsers,
  canViewTemporaryPasswords,
  clearTemporaryPasswordBackup,
  createPasswordReset,
  createSubAdminUser,
  deleteAdminUser,
  listAdminUsers,
  saveTemporaryPasswordBackup,
  setAdminUserPaused,
  validateAdminSessionToken,
} from "@/lib/admin-users";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionToken,
} from "@/lib/admin-session";
import { sendAdminInviteEmail } from "@/lib/admin-mailer";
import {
  getDevErrorDiagnostic,
  logServerError,
  type DevErrorDiagnostic,
  withErrorHandler,
} from "@/lib/server-error";

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

async function requireAdminSession() {
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = await validateAdminSessionToken(getAdminSessionToken(cookieValue));

  return session;
}

export const GET = withErrorHandler(async () => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const canViewFallbackCredentials = canViewTemporaryPasswords(session.user);
  const users = (await listAdminUsers()).map((user) =>
    canViewFallbackCredentials
      ? user
      : { ...user, temporaryPasswordBackup: undefined },
  );

  return NextResponse.json({
    currentAdminEmail: session.user.email,
    currentAdminRole: session.user.role,
    canManageAdmins: canManageAdminUsers(session.user),
    canModerateAdmins: canModerateAdminUsers(session.user),
    canViewFallbackCredentials,
    sessionExpiresAt: session.expiresAt,
    users,
  });
});

export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  if (!canManageAdminUsers(session.user)) {
    return NextResponse.json(
      { message: "Only authorized admin accounts can add admins." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    name?: string;
    designation?: string;
    email?: string;
  };
  const name = body.name?.trim() ?? "";
  const designation = body.designation?.trim() ?? "";
  const email = body.email?.trim() ?? "";

  if (!name || !designation || !email) {
    return NextResponse.json(
      { message: "Name, designation, and email are required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const { user, temporaryPassword } = await createSubAdminUser({
      name,
      designation,
      email,
    });
    let mail: {
      sent: boolean;
      reason: string | null;
      diagnostic?: DevErrorDiagnostic;
    } = {
      sent: false,
      reason: "The invitation email is not available right now.",
    };

    try {
      const reset = await createPasswordReset(user.email);

      if (!reset) {
        throw new Error("Setup link could not be prepared.");
      }

      const setupUrl = `${getBaseUrl()}/admin/reset-password?token=${encodeURIComponent(reset.token)}`;
      mail = await sendAdminInviteEmail({ user, setupUrl });
    } catch (error) {
      const report = logServerError(error, {
        operation: "prepare-admin-invitation-email",
        path: "/api/admin/users",
        recipient: user.email,
      });
      mail.diagnostic = getDevErrorDiagnostic(report);
      // Account creation remains successful; authorized admins receive a
      // temporary password for manual delivery below.
    }

    if (mail.sent) {
      await clearTemporaryPasswordBackup(user.id);
    } else {
      await saveTemporaryPasswordBackup(user.id, temporaryPassword);
    }

    const canViewFallbackCredentials = canViewTemporaryPasswords(session.user);
    const responseUser = mail.sent || !canViewFallbackCredentials
      ? user
      : { ...user, temporaryPasswordBackup: temporaryPassword };

    return NextResponse.json({
      user: responseUser,
      temporaryPassword:
        mail.sent || !canViewFallbackCredentials ? null : temporaryPassword,
      setupLinkSent: mail.sent,
      mail,
    });
  } catch (error) {
    const status = error instanceof AdminUserError ? error.status : 400;

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not create admin user.",
      },
      { status },
    );
  }
});

export const PATCH = withErrorHandler(async (request: Request) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  if (!canModerateAdminUsers(session.user)) {
    return NextResponse.json(
      { message: "Only IT Administrator can pause admin accounts." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    userId?: string;
    paused?: boolean;
  };

  if (!body.userId || typeof body.paused !== "boolean") {
    return NextResponse.json(
      { message: "Admin account and pause state are required." },
      { status: 400 },
    );
  }

  try {
    const user = await setAdminUserPaused(body.userId, body.paused);

    return NextResponse.json({ user });
  } catch (error) {
    const status = error instanceof AdminUserError ? error.status : 400;

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not update admin account.",
      },
      { status },
    );
  }
});

export const DELETE = withErrorHandler(async (request: Request) => {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  if (!canModerateAdminUsers(session.user)) {
    return NextResponse.json(
      { message: "Only IT Administrator can delete admin accounts." },
      { status: 403 },
    );
  }

  const userId = new URL(request.url).searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { message: "Admin account is required." },
      { status: 400 },
    );
  }

  try {
    await deleteAdminUser(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdminUserError ? error.status : 400;

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not delete admin account.",
      },
      { status },
    );
  }
});
