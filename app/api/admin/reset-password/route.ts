import { NextResponse } from "next/server";
import { AdminUserError, resetPasswordWithToken } from "@/lib/admin-users";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as {
    token?: string;
    password?: string;
    confirmPassword?: string;
  };
  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!token) {
    return NextResponse.json(
      { message: "Reset token is missing." },
      { status: 400 },
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { message: "Passwords do not match." },
      { status: 400 },
    );
  }

  try {
    await resetPasswordWithToken(token, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not reset password.",
      },
      { status: error instanceof AdminUserError ? error.status : 400 },
    );
  }
});
