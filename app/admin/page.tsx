import { requireAdminPageSession } from "@/lib/admin-auth";
import { AdminDashboard } from "@/features/test/components/admin-dashboard";

export default async function AdminPage() {
  await requireAdminPageSession();
  return <AdminDashboard />;
}
