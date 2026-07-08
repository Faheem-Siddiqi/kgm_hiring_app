import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionToken,
} from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";

export async function requireAdminPageSession(redirectTo?: string) {
  const cookieStore = await cookies();
  const session = await validateAdminSessionToken(
    getAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value),
  );

  if (!session) {
    cookieStore.delete(ADMIN_SESSION_COOKIE);
    const query = new URLSearchParams({ reason: "expired" });
    if (redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) {
      query.set("redirect", redirectTo);
    }
    redirect(`/admin/auth-required?${query.toString()}`);
  }

  return session;
}
