import { requireAdminPageSession } from "@/lib/admin-auth";
import { AdminDashboard } from "@/features/test/components/admin-dashboard";
import { listAssessments } from "@/lib/assessments";
import { listJobs } from "@/lib/jobs";

export default async function AdminPage() {
  await requireAdminPageSession();
  const [assessmentSetup, jobSetup] = await Promise.all([
    listAssessments(),
    listJobs({ includeInactive: true }),
  ]);

  return (
    <AdminDashboard
      initialServerAssessments={assessmentSetup.assessments}
      initialServerAssessmentSummary={assessmentSetup.summary}
      initialPublicJobs={jobSetup.jobs}
    />
  );
}
