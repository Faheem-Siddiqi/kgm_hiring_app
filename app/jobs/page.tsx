import { JobListing } from "@/features/jobs/components/job-listing";
import { listJobs, parsePaginationParams } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const page = Array.isArray(params.page) ? params.page[0] : params.page;
  const pageSize = Array.isArray(params.pageSize) ? params.pageSize[0] : params.pageSize;

  if (page) query.set("page", page);
  if (pageSize) query.set("pageSize", pageSize);

  const { jobs, pagination } = await listJobs({
    ...parsePaginationParams(query),
    includeInactive: true,
  });

  return <JobListing jobs={jobs} pagination={pagination} />;
}
