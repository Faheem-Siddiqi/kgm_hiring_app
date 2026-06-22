import { notFound } from "next/navigation";
import { JobDetail } from "@/features/jobs/components/job-detail";
import { candidateJobs, getCandidateJob } from "@/features/jobs/job-data";

export function generateStaticParams() {
  return candidateJobs.map((job) => ({ jobId: job.id }));
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = getCandidateJob(jobId);

  if (!job) {
    notFound();
  }

  return <JobDetail job={job} />;
}
