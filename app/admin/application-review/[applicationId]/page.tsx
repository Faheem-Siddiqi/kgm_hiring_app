import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-session";
import { validateAdminSessionToken } from "@/lib/admin-users";
import { AdminApplicationReviewGate } from "@/features/jobs/components/admin-application-review-gate";

export default async function AdminApplicationReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = await validateAdminSessionToken(getAdminSessionToken(cookieValue));

  return (
    <AdminApplicationReviewGate
      applicationId={applicationId}
      initiallyAuthenticated={Boolean(session)}
    />
  );
}
