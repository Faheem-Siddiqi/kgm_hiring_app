import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function LoadingSection() {
  return (
    <main className="min-h-svh bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.8fr_1.4fr]">
        <aside className="space-y-6">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex gap-2">
                <SkeletonLine className="h-6 w-24" />
                <SkeletonLine className="h-6 w-20" />
              </div>
              <SkeletonLine className="h-8 w-44" />
              <SkeletonLine className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-5">
              <SkeletonLine className="h-3 w-full" />
              <SkeletonLine className="h-3 w-11/12" />
              <SkeletonLine className="h-3 w-10/12" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <SkeletonLine className="h-6 w-28" />
              <SkeletonLine className="h-4 w-48" />
            </CardHeader>
            <CardContent className="grid gap-2">
              <SkeletonLine className="h-10 w-full" />
              <SkeletonLine className="h-10 w-full" />
              <SkeletonLine className="h-10 w-full" />
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <div className="flex justify-between">
            <SkeletonLine className="h-10 w-32" />
            <SkeletonLine className="h-6 w-40" />
          </div>
          <Card>
            <CardHeader className="space-y-4">
              <SkeletonLine className="h-4 w-48" />
              <SkeletonLine className="h-8 w-full" />
              <SkeletonLine className="h-8 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-6">
              <SkeletonLine className="h-36 w-full" />
              <div className="flex justify-between border-t pt-6">
                <SkeletonLine className="h-10 w-24" />
                <SkeletonLine className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
