import { AdminNavbar } from "@/components/admin/admin-navbar";

export default function AdminCandidateApplicationsLoading() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted/20" />
          ))}
        </div>
        <div className="h-[520px] animate-pulse rounded-lg border bg-muted/20" />
      </section>
    </main>
  );
}
