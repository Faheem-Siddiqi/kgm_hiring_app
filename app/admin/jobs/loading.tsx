function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AdminJobsLoading() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-7 w-24" />
            <SkeletonBlock className="h-10 w-64 max-w-full" />
            <SkeletonBlock className="h-5 w-[560px] max-w-full" />
          </div>
          <SkeletonBlock className="h-10 w-44" />
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-card p-4">
              <SkeletonBlock className="mb-3 size-5" />
              <SkeletonBlock className="h-4 w-16" />
              <SkeletonBlock className="mt-2 h-8 w-14" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-lg border bg-card">
            <div className="flex flex-col gap-4 border-b bg-muted/20 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <SkeletonBlock className="h-6 w-32" />
                <SkeletonBlock className="h-4 w-60" />
              </div>
              <SkeletonBlock className="h-9 w-28" />
            </div>
            <div className="space-y-4 p-5">
              <SkeletonBlock className="h-10 w-full" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-md border p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <SkeletonBlock className="h-6 w-44" />
                        <SkeletonBlock className="h-6 w-20" />
                      </div>
                      <SkeletonBlock className="h-4 w-full" />
                      <SkeletonBlock className="h-4 w-3/4" />
                      <div className="flex flex-wrap gap-2">
                        <SkeletonBlock className="h-5 w-20" />
                        <SkeletonBlock className="h-5 w-24" />
                        <SkeletonBlock className="h-5 w-28" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <SkeletonBlock className="h-9 w-20" />
                      <SkeletonBlock className="h-9 w-20" />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <SkeletonBlock className="h-5 w-44" />
                <div className="flex gap-2">
                  <SkeletonBlock className="h-9 w-20" />
                  <SkeletonBlock className="h-9 w-16" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="space-y-2 border-b p-6">
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-4 w-64" />
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <SkeletonBlock className="h-10 w-full" />
                <SkeletonBlock className="h-10 w-full" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SkeletonBlock className="h-10 w-full" />
                <SkeletonBlock className="h-10 w-full" />
              </div>
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-24 w-full" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
