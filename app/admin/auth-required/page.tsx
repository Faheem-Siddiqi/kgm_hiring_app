import Link from "next/link";
import { BriefcaseBusiness, LockKeyhole, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminAuthRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isExpired = reason === "expired";

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="space-y-5">
            <Badge variant="secondary" className="w-fit gap-2">
              <ShieldAlert className="size-3.5" />
              Admin access required
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
                {isExpired ? "Your session has ended" : "Sign in to continue"}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {isExpired
                  ? "For security, admin sessions expire after a period of inactivity. Sign in again to continue managing jobs, candidates, and assessments."
                  : "This area is reserved for authorized hiring team members. Please sign in with an approved admin account to open the workspace."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/admin/login">
                  <LockKeyhole className="size-4" />
                  Sign in
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/jobs">
                  <BriefcaseBusiness className="size-4" />
                  Browse open jobs
                </Link>
              </Button>
            </div>
          </div>

          <Card className="shadow-xs">
            <CardHeader>
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BriefcaseBusiness className="size-5" />
              </div>
              <CardTitle>Hiring Workspace</CardTitle>
              <CardDescription>
                Protected tools for posting jobs, managing assessment resources,
                and reviewing candidate activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {[
                "Create and pause job postings",
                "Bind postings to assessment resources",
                "Manage administrator access",
              ].map((item) => (
                <div key={item} className="rounded-md border bg-muted/20 px-3 py-2">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
