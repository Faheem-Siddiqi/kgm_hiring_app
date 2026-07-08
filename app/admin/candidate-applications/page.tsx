import { requireAdminPageSession } from "@/lib/admin-auth";
import { CandidateApplicationsInbox } from "@/features/jobs/components/candidate-applications-inbox";

export default async function AdminCandidateApplicationsPage() {
  await requireAdminPageSession("/admin/candidate-applications");

  return <CandidateApplicationsInbox />;
}
