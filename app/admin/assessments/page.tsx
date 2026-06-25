import { AdminAssessments } from "@/features/test/components/admin-assessments";
import { requireAdminPageSession } from "@/lib/admin-auth";
import { listAssessments } from "@/lib/assessments";

export const dynamic = "force-dynamic";

export default async function AdminAssessmentsPage() {
  await requireAdminPageSession();
  const assessmentSetup = await listAssessments();

  return (
    <AdminAssessments
      initialAssessments={assessmentSetup.assessments}
      questionBanks={assessmentSetup.questionBanks}
    />
  );
}
