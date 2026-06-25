import { notFound } from "next/navigation";
import { AdminJobDetail } from "@/features/jobs/components/admin-job-detail";
import { requireAdminPageSession } from "@/lib/admin-auth";
import { listAssessments } from "@/lib/assessments";
import { getJobBySlug } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await requireAdminPageSession();
  const { jobId } = await params;
  const [job, assessmentSetup] = await Promise.all([
    getJobBySlug(jobId, { includeInactive: true }),
    listAssessments(),
  ]);

  if (!job) {
    notFound();
  }

  return (
    <AdminJobDetail
      job={job}
      assessments={assessmentSetup.assessments.map((assessment) => ({
        id: assessment.id,
        code: assessment.code,
        name: assessment.name,
        questionBankName: assessment.questionBankName,
        questionBankId: assessment.questionBankId,
        tags: [
          assessment.code,
          assessment.name,
          assessment.questionBankName,
          ...assessment.assignedJobs.map((assignedJob) => assignedJob.title),
        ],
      }))}
    />
  );
}
