import { requireAdminPageSession } from "@/lib/admin-auth";
import { getAssessmentById } from "@/lib/assessments";
import { AdminAssessmentDetail } from "@/features/test/components/admin-assessment-detail";
import { AssessmentAnalytics } from "@/features/test/components/assessment-analytics";
import { redirect } from "next/navigation";

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ submission?: string | string[] }>;
}) {
  await requireAdminPageSession();
  const { assessmentId } = await params;
  const { submission } = await searchParams;

  if (submission) {
    redirect(`/admin/submissions/${Array.isArray(submission) ? submission[0] : submission}`);
  }

  const assessment = await getAssessmentById(assessmentId);

  if (assessment) {
    return <AdminAssessmentDetail assessment={assessment} />;
  }

  return <AssessmentAnalytics assessmentId={assessmentId} />;
}
