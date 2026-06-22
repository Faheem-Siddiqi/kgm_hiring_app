import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  MapPin,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CandidateJob } from "@/features/jobs/job-data";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function JobDetail({ job }: { job: CandidateJob }) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/jobs" className="flex min-w-0 items-center gap-2 font-semibold">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card">
              <BriefcaseBusiness className="size-4" />
            </span>
            <span className="truncate">KGM Careers</span>
          </Link>
          <Button asChild size="sm">
            <Link href="/test">
              Attempt assessment
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="/jobs">
            <ArrowLeft className="size-4" />
            Back to jobs
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{job.department}</Badge>
                  <Badge variant="outline">{job.level}</Badge>
                  <Badge variant="outline">{job.type}</Badge>
                </div>
                <div>
                  <CardTitle className="text-3xl sm:text-4xl">{job.title}</CardTitle>
                  <CardDescription className="mt-3 max-w-3xl text-sm leading-6">
                    {job.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Location", value: job.location, icon: MapPin },
                  { label: "Created", value: formatDate(job.createdAt), icon: CalendarDays },
                  { label: "Closing date", value: formatDate(job.closingAt), icon: CalendarDays },
                  { label: "Salary", value: job.salary, icon: WalletCards },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-md border p-4">
                    <Icon className="mb-3 size-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-medium">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Responsibilities</CardTitle>
                <CardDescription>What this role will own day to day.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                  {job.responsibilities.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
                <CardDescription>Baseline profile for this dummy opening.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                  {job.requirements.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
            <Card>
              <CardHeader>
                <CardTitle>Assessment step</CardTitle>
                <CardDescription>
                  This CTA connects the dummy job flow to the existing `/test`
                  assessment route.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted/25 p-4">
                  <ClipboardCheck className="mb-3 size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{job.assessment}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    You will continue to the current assessment overview. Real job-to-test
                    matching can be wired later.
                  </p>
                </div>
                <Button asChild className="w-full" size="lg">
                  <Link href="/test">
                    Apply and attempt assessment
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/jobs">Review other jobs</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Job snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Department</span>
                  <span className="font-medium">{job.department}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Work type</span>
                  <span className="font-medium">{job.type}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Level</span>
                  <span className="font-medium">{job.level}</span>
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {job.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  About this dummy page
                </CardTitle>
                <CardDescription>
                  Built as a temporary candidate-facing route so the job browsing
                  journey can be tested before real job data is connected.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
