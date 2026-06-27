import { AdminSubmissionDetail } from "@/features/test/components/admin-submission-detail";
import { requireAdminPageSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  await requireAdminPageSession();
  const { submissionId } = await params;

  return <AdminSubmissionDetail submissionId={submissionId} />;
}
