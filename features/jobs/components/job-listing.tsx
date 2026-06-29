"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
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
import { Input } from "@/components/ui/input";
import type { Pagination, PublicJob } from "@/lib/job-types";

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
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <UserCheck className="size-4" />
                Candidate portal
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/login">
                <ShieldCheck className="size-4" />
                Admin
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit gap-2">
              <BriefcaseBusiness className="size-3.5" />
              Open roles
            </Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Find the right KGM assessment path
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Browse open job postings, review role details, and start the
                assessment flow from the job that matches your application.
              </p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Application flow</CardTitle>
              <CardDescription>
                Review open roles and continue to the current assessment route.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {["Search jobs", "Open detail", "Attempt assessment"].map((item, index) => (
                <div key={item} className="rounded-md border p-4">
                  <p className="text-xs text-muted-foreground">Step {index + 1}</p>
                  <p className="mt-1 font-medium">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-4 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Job listing</CardTitle>
              <CardDescription>
                Search by title, department, location, experience, or keyword.
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-7 rounded-md px-3">
              {filteredJobs.length} matching roles
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px]">
              <div className="relative">
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
                className="h-10 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-input focus-visible:ring-0"
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
                className="h-10 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-input focus-visible:ring-0"
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

            <div className="grid gap-4">
              {filteredJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.slug}`}
                  className="group rounded-lg border bg-card p-4 transition hover:border-foreground/30 hover:bg-muted/30"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{job.title}</h2>
                        <Badge variant="outline">{job.experience}</Badge>
                        <Badge variant="secondary" className="capitalize">
                          {job.status}
                        </Badge>
                      </div>
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        {job.summary}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {job.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[11px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <span className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition group-hover:bg-accent">
                      View job
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-4">
                    <span className="flex items-center gap-2">
                      <Building2 className="size-3.5" />
                      {job.department}
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin className="size-3.5" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock3 className="size-3.5" />
                      Created {formatDate(job.createdAt)}
                    </span>
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="size-3.5" />
                      {job.assessments.length
                        ? `${job.assessments.length} assessment${job.assessments.length === 1 ? "" : "s"}`
                        : job.experience}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total jobs
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" disabled={pagination.page <= 1}>
                  <Link href={`/jobs?page=${Math.max(1, pagination.page - 1)}&pageSize=${pagination.pageSize}`}>
                    Previous
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <Link href={`/jobs?page=${Math.min(pagination.totalPages, pagination.page + 1)}&pageSize=${pagination.pageSize}`}>
                    Next
                  </Link>
                </Button>
              </div>
            </div>

            {!filteredJobs.length ? (
              <div className="rounded-md border border-dashed px-4 py-10 text-center">
                <p className="text-sm font-medium">No jobs found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different title, department, location, or level.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
