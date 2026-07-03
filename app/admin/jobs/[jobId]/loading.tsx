import { AdminNavbar } from "@/components/admin/admin-navbar";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted [animation-duration:1.6s] motion-reduce:animate-none ${className}`}
    />
  );
}

export default function AdminJobDetailLoading() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-card p-4 shadow-xs">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <SkeletonBlock className="size-10 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <SkeletonBlock className="h-6 w-20" />
                  <SkeletonBlock className="h-4 w-44" />
                </div>
                <SkeletonBlock className="h-8 w-80 max-w-full" />
                <SkeletonBlock className="h-4 w-[640px] max-w-full" />
                <SkeletonBlock className="h-4 w-[480px] max-w-full" />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SkeletonBlock className="h-12 w-44" />
              <SkeletonBlock className="h-10 w-32" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-card p-4">
              <SkeletonBlock className="mb-3 size-5" />
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="mt-2 h-8 w-20" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border bg-card">
            <div className="space-y-2 border-b p-6">
              <SkeletonBlock className="h-6 w-36" />
              <SkeletonBlock className="h-4 w-96 max-w-full" />
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-md border p-4">
                    <SkeletonBlock className="mb-3 size-4" />
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="mt-3 h-7 w-16" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <SkeletonBlock className="h-4 w-36" />
                  <SkeletonBlock className="h-4 w-16" />
                </div>
                <SkeletonBlock className="h-3 w-full rounded-full" />
              </div>
              <div className="rounded-md border p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-5 w-44" />
                    <SkeletonBlock className="h-4 w-72 max-w-full" />
                  </div>
                  <SkeletonBlock className="h-16 w-32" />
                </div>
                <div className="grid h-48 grid-cols-4 items-end gap-3 rounded-md bg-muted/20 p-3">
                  <SkeletonBlock className="h-1/3 w-full self-end" />
                  <SkeletonBlock className="h-1/2 w-full self-end" />
                  <SkeletonBlock className="h-3/4 w-full self-end" />
                  <SkeletonBlock className="h-full w-full self-end" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border bg-card">
              <div className="space-y-2 border-b p-6">
                <SkeletonBlock className="h-6 w-36" />
                <SkeletonBlock className="h-4 w-72" />
              </div>
              <div className="space-y-3 p-6">
                <SkeletonBlock className="h-10 w-full" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SkeletonBlock className="h-10 w-full" />
                  <SkeletonBlock className="h-10 w-full" />
                </div>
                <SkeletonBlock className="h-10 w-full" />
              </div>
            </div>

            <div className="rounded-lg border bg-card">
              <div className="border-b p-6">
                <SkeletonBlock className="h-6 w-44" />
              </div>
              <div className="space-y-2 p-6">
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="space-y-2 border-b p-6">
            <SkeletonBlock className="h-6 w-40" />
            <SkeletonBlock className="h-4 w-80 max-w-full" />
          </div>
          <div className="grid gap-3 p-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
