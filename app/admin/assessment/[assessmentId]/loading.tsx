function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AdminAssessmentDetailLoading() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonBlock className="size-10 shrink-0" />
            <div className="min-w-0 space-y-2">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-7 w-72 max-w-full" />
            </div>
          </div>
          <SkeletonBlock className="h-7 w-36" />
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

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border bg-card">
            <div className="space-y-2 border-b p-6">
              <SkeletonBlock className="h-6 w-44" />
              <SkeletonBlock className="h-4 w-64" />
            </div>
            <div className="space-y-4 p-6">
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-28 w-full" />
              <SkeletonBlock className="h-10 w-36" />
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="space-y-2 border-b p-6">
              <SkeletonBlock className="h-6 w-52" />
              <SkeletonBlock className="h-4 w-80 max-w-full" />
            </div>
            <div className="space-y-4 p-6">
              <div className="flex gap-5 border-b">
                <SkeletonBlock className="h-9 w-20 rounded-none" />
                <SkeletonBlock className="h-9 w-20 rounded-none" />
                <SkeletonBlock className="h-9 w-20 rounded-none" />
              </div>
              <SkeletonBlock className="h-52 w-full" />
              <SkeletonBlock className="h-10 w-44" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="space-y-2 border-b p-6">
            <SkeletonBlock className="h-6 w-32" />
            <SkeletonBlock className="h-4 w-80 max-w-full" />
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-28" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
