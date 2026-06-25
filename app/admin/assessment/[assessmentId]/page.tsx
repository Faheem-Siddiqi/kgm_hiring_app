import { requireAdminPageSession } from "@/lib/admin-auth";
import { getAssessmentById } from "@/lib/assessments";
import { AdminAssessmentDetail } from "@/features/test/components/admin-assessment-detail";
import { AssessmentAnalytics } from "@/features/test/components/assessment-analytics";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  await requireAdminPageSession();
  const { assessmentId } = await params;
  const assessment = await getAssessmentById(assessmentId);

  if (assessment) {
    return <AdminAssessmentDetail assessment={assessment} />;
  }

  return <AssessmentAnalytics assessmentId={assessmentId} />;
}
