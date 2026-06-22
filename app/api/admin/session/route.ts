import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createAdminSession,
  deleteAdminSessionToken,
  findAdminUserByCredentials,
} from "@/lib/admin-users";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionValue,
  getAdminSessionToken,
} from "@/lib/admin-session";
import { withErrorHandler } from "@/lib/server-error";

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const adminUser = await findAdminUserByCredentials(email, password);

  if (!adminUser) {
    return NextResponse.json(
      { message: "The email or password is incorrect." },
      { status: 401 },
    );
  }

  const session = await createAdminSession(adminUser);

  (await cookies()).set(ADMIN_SESSION_COOKIE, createAdminSessionValue(session.token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    expires: session.expiresAt,
    path: "/",
  });

  return NextResponse.json({
    ok: true,
    expiresAt: session.expiresAt.toISOString(),
    mustChangePassword: adminUser.mustChangePassword,
  });
});

export const DELETE = withErrorHandler(async () => {
  const cookieStore = await cookies();
  await deleteAdminSessionToken(
    getAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value),
  );
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
});
