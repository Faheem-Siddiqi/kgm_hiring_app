import { AdminSettings } from "@/features/auth/components/admin-settings";
import { requireAdminPageSession } from "@/lib/admin-auth";

export default async function AdminSettingsPage() {
  await requireAdminPageSession();
  return <AdminSettings />;
}
