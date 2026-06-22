import { requireAdminPageSession } from "@/lib/admin-auth";
import { AssessmentAnalytics } from "@/features/test/components/assessment-analytics";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  await requireAdminPageSession();
  const { assessmentId } = await params;

  return <AssessmentAnalytics assessmentId={assessmentId} />;
}
