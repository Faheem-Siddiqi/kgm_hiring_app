function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AdminAssessmentsLoading() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-7 w-32" />
            <SkeletonBlock className="h-10 w-72 max-w-full" />
            <SkeletonBlock className="h-5 w-[520px] max-w-full" />
          </div>
          <SkeletonBlock className="h-10 w-32" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div className="order-2 rounded-lg border bg-card lg:order-1">
            <div className="flex items-center justify-between gap-4 border-b bg-muted/20 p-6">
              <div className="space-y-2">
                <SkeletonBlock className="h-6 w-44" />
                <SkeletonBlock className="h-4 w-72" />
              </div>
              <SkeletonBlock className="h-7 w-20" />
            </div>
            <div className="space-y-4 p-5">
              <SkeletonBlock className="h-10 w-full" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-md border p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex gap-2">
                        <SkeletonBlock className="h-6 w-24" />
                        <SkeletonBlock className="h-6 w-32" />
                      </div>
                      <SkeletonBlock className="h-5 w-64 max-w-full" />
                      <SkeletonBlock className="h-4 w-full" />
                    </div>
                    <div className="grid w-full grid-cols-3 gap-3 md:w-64">
                      <SkeletonBlock className="h-12" />
                      <SkeletonBlock className="h-12" />
                      <SkeletonBlock className="h-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 rounded-lg border bg-card lg:order-2">
            <div className="space-y-2 border-b p-6">
              <SkeletonBlock className="h-6 w-40" />
              <SkeletonBlock className="h-4 w-72" />
            </div>
            <div className="space-y-4 p-6">
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-28 w-full" />
              <SkeletonBlock className="h-10 w-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
