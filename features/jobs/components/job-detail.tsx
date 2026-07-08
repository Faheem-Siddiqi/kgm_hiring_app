"use client";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Clock3,
  FileQuestion,
  MapPin,
  ShieldCheck,
  Target,
  UserCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  HiringOfficeCard,
  JobApplicationCard,
} from "@/features/jobs/components/job-application-card";
import type { PublicJob } from "@/lib/job-types";
import { cn } from "@/lib/utils";
import LightLogo from "@/src/assets/LightLogo.png";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function DetailList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div
          key={item}
          className="group flex gap-3 rounded-md border bg-background p-4 transition hover:border-foreground/20 hover:bg-muted/30"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/30 text-xs font-semibold text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 text-sm leading-6 text-foreground/85">
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

export function JobDetail({ job }: { job: PublicJob }) {
  const assessmentCount = job.assessments.length;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link
            href="/jobs"
            className="flex min-w-0 items-center gap-3 font-semibold"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card">
              <Image
                src={LightLogo}
                alt="KGM hiring workspace logo"
                className="size-6 object-contain grayscale"
                priority
              />
            </span>
            <span className="truncate text-sm sm:text-base">KGM Careers</span>
          </Link>

          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center">
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-full gap-2 sm:w-auto",
              )}
            >
              <UserCheck className="size-4" />
              <span className="truncate">Candidate portal</span>
            </Link>
            <Link
              href="/admin/login"
              className={cn(
                buttonVariants({ size: "sm" }),
                "w-full gap-2 sm:w-auto",
              )}
            >
              <ShieldCheck className="size-4" />
              <span className="truncate">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:px-8">
        <div className="grid min-w-0 gap-6">
          <Card className="rounded-lg">
            <CardContent className="space-y-6 p-5 sm:p-6">
              <Link
                href="/jobs"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-fit gap-2",
                )}
              >
                <ArrowLeft className="size-4" />
                Back to jobs
              </Link>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {job.status}
                  </Badge>
                  <Badge variant="outline">{job.experience}</Badge>
                  <Badge variant="outline">{job.location}</Badge>
                </div>

                <div className="space-y-3">
                  <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                    {job.title}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {job.summary}
                  </p>
                </div>

                <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="truncate">{job.department}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{job.location}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <Clock3 className="size-3.5 shrink-0" />
                    <span className="truncate">
                      Created {formatDate(job.createdAt)}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <BriefcaseBusiness className="size-3.5 shrink-0" />
                    <span className="truncate">{job.experience}</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Role details</CardTitle>
              <CardDescription>
                Review the role before submitting your application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {job.description}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-lg">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle>Role expectations</CardTitle>
              <CardDescription>
                A quick view of what the role handles and the profile expected.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
              <section className="rounded-lg border bg-card p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
                      <Target className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">
                        Responsibilities
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        What this role owns day to day.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-md">
                    {job.responsibilities.length}
                  </Badge>
                </div>
                <DetailList
                  items={job.responsibilities}
                />
              </section>

              <section className="rounded-lg border bg-card p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
                      <BriefcaseBusiness className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">Requirements</h2>
                      <p className="text-sm text-muted-foreground">
                        Baseline profile for this opening.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-md">
                    {job.requirements.length}
                  </Badge>
                </div>
                <DetailList items={job.requirements} />
              </section>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Assessment path</CardTitle>
              <CardDescription>
                {assessmentCount
                  ? `${assessmentCount} assessment${
                      assessmentCount === 1 ? "" : "s"
                    } attached to this role.`
                  : "The hiring team has not attached an assessment yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {job.assessments.length ? (
                job.assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="rounded-md border bg-muted/20 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                        <FileQuestion className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="break-words text-sm font-medium">
                          {assessment.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assessment.questionBankName}
                        </p>
                       
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  Assessment setup is pending for this role.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="grid min-w-0 gap-6 lg:sticky lg:top-24 lg:self-start [&>*]:w-full">
          <JobApplicationCard jobs={[job]} />
          <HiringOfficeCard />
        </aside>
      </section>
    </main>
  );
}
