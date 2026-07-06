import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  MapPin,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PublicJob } from "@/lib/job-types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function DetailTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group rounded-xl border bg-card/80 p-4 transition hover:bg-muted/30">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg border bg-background">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 px-3 py-2.5">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

export function JobDetail({ job }: { job: PublicJob }) {
  const primaryAssessment = job.assessments[0];

  const jobDetails = [
    {
      label: "Location",
      value: job.location,
      icon: MapPin,
    },
    {
      label: "Experience",
      value: job.experience,
      icon: WalletCards,
    },
    {
      label: "Created",
      value: formatDate(job.createdAt),
      icon: CalendarDays,
    },
    {
      label: "Updated",
      value: formatDate(job.updatedAt),
      icon: CalendarDays,
    },
  ];

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/jobs"
            className="flex min-w-0 items-center gap-2 font-semibold"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card">
              <BriefcaseBusiness className="size-4" />
            </span>
            <span className="truncate">KGM Careers</span>
          </Link>

          <Button asChild className="shrink-0" size="sm" variant="outline">
            <Link href="/">Candidate portal</Link>
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="border-b bg-muted/20">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-md">
                      {job.department}
                    </Badge>
                    <Badge variant="outline" className="rounded-md">
                      {job.experience}
                    </Badge>
                    <Badge variant="outline" className="rounded-md capitalize">
                      {job.status}
                    </Badge>
                  </div>

                  <div className="max-w-4xl">
                    <CardTitle className="text-3xl leading-tight sm:text-4xl">
                      {job.title}
                    </CardTitle>
                    <CardDescription className="mt-3 text-sm leading-6">
                      {job.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {jobDetails.map((item) => (
                  <DetailTile
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    icon={item.icon}
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Responsibilities</CardTitle>
                <CardDescription>
                  What this role will own day to day.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="grid gap-3 text-sm leading-6 text-muted-foreground">
                  {job.responsibilities.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 rounded-lg border bg-muted/15 p-3"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Requirements</CardTitle>
                <CardDescription>
                  Baseline profile for this opening.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="grid gap-3 text-sm leading-6 text-muted-foreground">
                  {job.requirements.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 rounded-lg border bg-muted/15 p-3"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
            <Card className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="size-5" />
                  Assessment step
                </CardTitle>
                <CardDescription>
                  Candidates open assessments only through their invitation OTP.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Primary assessment
                  </p>

                  <p className="mt-2 text-sm font-semibold">{job.title}</p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {primaryAssessment
                      ? `You will continue to ${primaryAssessment.code} · ${job.title}.`
                      : "No assessment is assigned to this job yet."}
                  </p>
                </div>

                {job.assessments.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Assigned assessments
                    </p>

                    <div className="space-y-2">
                      {job.assessments.map((assessment) => (
                        <div
                          key={assessment.id}
                          className="rounded-xl border bg-muted/15 p-3"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {assessment.name}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {assessment.questionBankName}
                              </p>
                            </div>

                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-md text-[11px]"
                            >
                              {assessment.code}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {primaryAssessment ? (
                  <Button asChild className="w-full">
                    <Link href="/">Open candidate portal</Link>
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    Open candidate portal
                  </Button>
                )}

                <Button asChild className="w-full" variant="outline">
                  <Link href="/jobs">Review other jobs</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Job snapshot</CardTitle>
                <CardDescription>
                  Quick role summary without clutter.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <SnapshotRow label="Department" value={job.department} />
                <SnapshotRow label="Location" value={job.location} />
                <SnapshotRow label="Status" value={job.status} />
                <SnapshotRow label="Experience" value={job.experience} />
                <SnapshotRow label="Created" value={formatDate(job.createdAt)} />
                <SnapshotRow label="Updated" value={formatDate(job.updatedAt)} />
                <SnapshotRow
                  label="Assessment"
                  value={
                    job.assessments.length
                      ? `${job.assessments.length} assigned`
                      : "Unassigned"
                  }
                />

                {job.tags.length ? (
                  <div className="border-t pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Tags
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {job.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="rounded-md"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-5" />
                  Kohinoor Textile Mills Limited
                </CardTitle>
                <CardDescription className="leading-6">
                  +92 51 3564337
                  <br />
                  info@kmlg.com
                </CardDescription>
              </CardHeader>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
} 