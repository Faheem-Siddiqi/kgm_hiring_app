import { AdminNavbar } from "@/components/admin/admin-navbar";
import { AdminHelpGuide } from "@/features/help/admin-help-guide";
import { requireAdminPageSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminHelpPage() {
  await requireAdminPageSession("/admin/help");

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <AdminHelpGuide />
    </main>
  );
}
