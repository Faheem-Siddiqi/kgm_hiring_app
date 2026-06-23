import { notFound } from "next/navigation";
import { JobDetail } from "@/features/jobs/components/job-detail";
import { getJobBySlug } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJobBySlug(jobId);

  if (!job) {
    notFound();
  }

  return <JobDetail job={job} />;
}
