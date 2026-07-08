"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";
import Image from "next/image";
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
import { Input } from "@/components/ui/input";
import { JobApplicationCard } from "@/features/jobs/components/job-application-card";
import type { Pagination, PublicJob } from "@/lib/job-types";
import LightLogo from "@/src/assets/LightLogo.png";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function JobListing({
  jobs,
  pagination,
}: {
  jobs: PublicJob[];
  pagination: Pagination;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [experience, setExperience] = useState("All");

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(jobs.map((job) => job.department)))],
    [jobs],
  );

  const experiences = useMemo(
    () => ["All", ...Array.from(new Set(jobs.map((job) => job.experience)))],
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesQuery = !query
        ? true
        : [
            job.title,
            job.department,
            job.location,
            job.summary,
            job.status,
            job.experience,
            ...job.tags,
          ].some((value) => value.toLowerCase().includes(query));

      const matchesDepartment =
        department === "All" || job.department === department;
      const matchesExperience =
        experience === "All" || job.experience === experience;

      return matchesQuery && matchesDepartment && matchesExperience;
    });
  }, [department, experience, jobs, searchQuery]);

  const hasPreviousPage = pagination.page > 1;
  const hasNextPage = pagination.page < pagination.totalPages;

  const previousPageHref = `/jobs?page=${Math.max(
    1,
    pagination.page - 1,
  )}&pageSize=${pagination.pageSize}`;

  const nextPageHref = `/jobs?page=${Math.min(
    pagination.totalPages,
    pagination.page + 1,
  )}&pageSize=${pagination.pageSize}`;

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

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
            >
              <Link href="/" className="justify-center gap-2">
                <UserCheck className="size-4" />
                Candidate portal
              </Link>
            </Button>
            <Button asChild size="sm" className="w-full sm:w-auto">
              <Link href="/admin/login" className="justify-center gap-2">
                <ShieldCheck className="size-4" />
                Admin
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-stretch">
          <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
              <Badge
                variant="secondary"
                className="w-fit gap-2 rounded-lg py-1.5 pl-1.5 pr-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card">
                  <Image
                    src={LightLogo}
                    alt="KGM hiring workspace logo"
                    className="size-6 object-contain grayscale"
                  />
                </span>
                Open roles
              </Badge>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  Find the right KGM assessment path
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Browse open job postings, review role details, and start the
                  assessment flow from the job that matches your application.
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>Application flow</CardTitle>
              <CardDescription>
                Review open roles and continue to the current assessment route.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {["Search jobs", "Open detail", "Attempt assessment"].map(
                (item, index) => (
                  <div
                    key={item}
                    className="rounded-lg border bg-muted/20 p-4 transition hover:bg-muted/30"
                  >
                    <p className="text-xs text-muted-foreground">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-medium">{item}</p>
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>Before you apply</CardTitle>
              <CardDescription>
                Keep your CV link public enough for the hiring team to open.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg border bg-muted/20 p-4 leading-6">
                Use a Google Drive, OneDrive, Dropbox, or other accessible CV
                link.
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 leading-6">
                Include your realistic interview and joining availability.
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 leading-6">
                The hiring team reviews applications in the protected admin
                workspace.
              </div>
            </CardContent>
          </Card>

          <div className="min-w-0">
            <JobApplicationCard jobs={jobs} />
          </div>
        </div>

        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-col gap-4 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Job listing</CardTitle>
              <CardDescription>
                Search by title, department, location, experience, or keyword.
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-7 w-fit rounded-md px-3">
              {filteredJobs.length} matching roles
            </Badge>
          </CardHeader>

          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(150px,180px)_minmax(140px,170px)]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 pl-9 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  placeholder="Search jobs, skills, or location"
                  aria-label="Search jobs"
                />
              </div>

              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-input focus-visible:ring-0"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                aria-label="Filter by department"
              >
                {departments.map((item) => (
                  <option key={item} value={item}>
                    {item === "All" ? "All departments" : item}
                  </option>
                ))}
              </select>

              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-input focus-visible:ring-0"
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                aria-label="Filter by experience"
              >
                {experiences.map((item) => (
                  <option key={item} value={item}>
                    {item === "All" ? "All experience" : item}
                  </option>
                ))}
              </select>
            </div>

            {filteredJobs.length ? (
              <div className="grid gap-4">
                {filteredJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.slug}`}
                    className="group block rounded-xl border bg-card p-4 transition hover:border-foreground/30 hover:bg-muted/30 hover:shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <h2 className="min-w-0 text-lg font-semibold leading-7">
                            {job.title}
                          </h2>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{job.experience}</Badge>
                            <Badge variant="secondary" className="capitalize">
                              {job.status}
                            </Badge>
                          </div>
                        </div>

                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                          {job.summary}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {job.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="rounded-md text-[11px]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-medium shadow-xs transition group-hover:bg-accent md:self-start">
                        <ArrowRight className="size-4" />
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
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
                        <SlidersHorizontal className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {job.assessments.length
                            ? `${job.assessments.length} assessment${
                                job.assessments.length === 1 ? "" : "s"
                              }`
                            : job.experience}
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                <p className="text-sm font-medium">No jobs found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different title, department, location, or level.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ·{" "}
                {pagination.total} total jobs
              </p>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={`w-full sm:w-auto ${
                    hasPreviousPage ? "" : "pointer-events-none opacity-50"
                  }`}
                >
                  <Link
                    href={previousPageHref}
                    aria-disabled={!hasPreviousPage}
                    tabIndex={hasPreviousPage ? undefined : -1}
                    className={
                      hasPreviousPage
                        ? undefined
                        : "pointer-events-none opacity-50"
                    }
                  >
                    Previous
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={`w-full sm:w-auto ${
                    hasNextPage ? "" : "pointer-events-none opacity-50"
                  }`}
                >
                  <Link
                    href={nextPageHref}
                    aria-disabled={!hasNextPage}
                    tabIndex={hasNextPage ? undefined : -1}
                    className={
                      hasNextPage ? undefined : "pointer-events-none opacity-50"
                    }
                  >
                    Next
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
