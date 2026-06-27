import { AdminSubmissions } from "@/features/test/components/admin-submissions";
import { requireAdminPageSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  await requireAdminPageSession();

  return <AdminSubmissions />;
}
