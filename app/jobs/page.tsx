import { JobListing } from "@/features/jobs/components/job-listing";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { jobs } = await listJobs();

  return <JobListing jobs={jobs} />;
}
