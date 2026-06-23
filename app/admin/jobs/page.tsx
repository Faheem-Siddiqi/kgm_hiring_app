import { AdminJobs } from "@/features/jobs/components/admin-jobs";
import { requireAdminPageSession } from "@/lib/admin-auth";
import { getJobAssessmentResourceOptions, listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  await requireAdminPageSession();
  const { jobs, summary } = await listJobs({ includeInactive: true });

  return (
    <AdminJobs
      initialJobs={jobs}
      initialSummary={summary}
      assessmentResources={getJobAssessmentResourceOptions()}
    />
  );
}
