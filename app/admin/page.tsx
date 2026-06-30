import { requireAdminPageSession } from "@/lib/admin-auth";
import { AdminDashboard } from "@/features/test/components/admin-dashboard";
import { listAssessments } from "@/lib/assessments";
import { listJobs } from "@/lib/jobs";
import { getHiringDashboardStats } from "@/lib/hiring-records";

export default async function AdminPage() {
  await requireAdminPageSession();
  const [assessmentSetup, jobSetup, hiringStats] = await Promise.all([
    listAssessments(),
    listJobs({ includeInactive: true }),
    getHiringDashboardStats(),
  ]);

  return (
    <AdminDashboard
      initialServerAssessments={assessmentSetup.assessments}
      initialServerAssessmentSummary={assessmentSetup.summary}
      initialPublicJobs={jobSetup.jobs}
      initialHiringStats={hiringStats}
    />
  );
}
