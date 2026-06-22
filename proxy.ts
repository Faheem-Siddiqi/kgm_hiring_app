import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  isAdminSessionValue,
} from "@/lib/admin-session";

export function proxy(request: NextRequest) {
  const publicAdminPaths = [
    "/admin/login",
    "/admin/forgot-password",
    "/admin/reset-password",
  ];
  const isPublicAdminPage = publicAdminPaths.includes(request.nextUrl.pathname);
  const isAuthenticated =
    isAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!isAuthenticated && !isPublicAdminPage) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
