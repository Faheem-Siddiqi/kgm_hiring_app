function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted [animation-duration:1.6s] motion-reduce:animate-none ${className}`}
    />
  );
}

export default function AdminDashboardLoading() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <SkeletonBlock className="size-9 shrink-0" />
            <SkeletonBlock className="h-5 w-44" />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <SkeletonBlock className="h-9 w-24" />
            <SkeletonBlock className="h-9 w-28" />
            <SkeletonBlock className="h-9 w-20" />
            <SkeletonBlock className="h-9 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <SkeletonBlock className="size-9" />
            <SkeletonBlock className="size-9" />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <SkeletonBlock className="h-7 w-40" />
            <SkeletonBlock className="h-10 w-[520px] max-w-full" />
            <SkeletonBlock className="h-5 w-[680px] max-w-full" />
            <SkeletonBlock className="h-5 w-[520px] max-w-full" />
          </div>
          <div className="rounded-lg border p-5">
            <SkeletonBlock className="h-6 w-36" />
            <SkeletonBlock className="mt-2 h-4 w-56" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-md border p-4">
                  <SkeletonBlock className="mb-3 size-5" />
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="mt-2 h-8 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-lg border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SkeletonBlock className="h-6 w-44" />
                  <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
                </div>
                <SkeletonBlock className="h-7 w-24" />
              </div>
              <div className="mt-5 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-md border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <SkeletonBlock className="h-5 w-44" />
                        <SkeletonBlock className="mt-2 h-4 w-full" />
                        <SkeletonBlock className="mt-2 h-4 w-2/3" />
                      </div>
                      <SkeletonBlock className="h-6 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border p-5">
              <SkeletonBlock className="h-6 w-32" />
              <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <SkeletonBlock className="h-5 w-56 max-w-full" />
                        <SkeletonBlock className="h-4 w-72 max-w-full" />
                      </div>
                      <SkeletonBlock className="h-9 w-32" />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <SkeletonBlock className="h-12" />
                      <SkeletonBlock className="h-12" />
                      <SkeletonBlock className="h-12" />
                    </div>
                    <SkeletonBlock className="mt-4 h-3 w-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <SkeletonBlock className="h-6 w-44" />
              <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
              <div className="mt-5 space-y-3">
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-24 w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
