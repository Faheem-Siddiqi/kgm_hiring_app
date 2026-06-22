import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionToken,
} from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";

export async function requireAdminPageSession() {
  const cookieStore = await cookies();
  const session = await validateAdminSessionToken(
    getAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value),
  );

  if (!session) {
    cookieStore.delete(ADMIN_SESSION_COOKIE);
    redirect("/admin/login?expired=1");
  }

  return session;
}
