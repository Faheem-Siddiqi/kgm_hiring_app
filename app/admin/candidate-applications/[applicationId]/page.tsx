import { AdminCandidateApplicationDetail } from "@/features/jobs/components/admin-candidate-application-detail";
import { requireAdminPageSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminCandidateApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  await requireAdminPageSession(`/admin/candidate-applications/${applicationId}`);

  return <AdminCandidateApplicationDetail applicationId={applicationId} />;
}
