"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MailX,
  Search,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AdminNavbar } from "@/components/admin/admin-navbar";
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

type CandidateApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  cvUrl: string;
  availability: string;
  emailStatus: "pending" | "sent" | "failed";
  emailFailure?: string;
  decisionStatus: "pending" | "invited" | "rejected";
  decisionEmailStatus?: "pending" | "sent" | "failed";
  decisionEmailFailure?: string;
  decidedAt?: string;
  createdAt: string;
};

type ApplicationsResponse = {
  message?: string;
  applications?: CandidateApplication[];
};

type ApplicationActionResponse = {
  message?: string;
  application?: CandidateApplication;
  mail?: { sent?: boolean; reason?: string | null };
};

const APPLICATIONS_PER_PAGE = 8;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CandidateApplicationsInbox() {
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [applicationPage, setApplicationPage] = useState(1);
  const [rejectingApplicationId, setRejectingApplicationId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadApplications() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/candidate-applications", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApplicationsResponse;

        if (!response.ok) {
          throw new Error(payload.message ?? "Could not load candidate applications.");
        }

        if (active) setApplications(payload.applications ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load candidate applications.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadApplications();

    return () => {
      active = false;
    };
  }, []);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return applications;

    return applications.filter((application) =>
      [
        application.candidateName,
        application.candidateEmail,
        application.jobTitle,
        application.availability,
        application.emailStatus,
        application.decisionStatus,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [applications, query]);

  const failedNotifications = applications.filter(
    (application) => application.emailStatus === "failed",
  ).length;
  const pendingDecisions = applications.filter(
    (application) => application.decisionStatus === "pending",
  ).length;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Candidate application inbox
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Review public job applications, open CV links, and convert qualified
                applicants into assessment invites.
              </p>
            </div>
          </div>
          
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total requests</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FileText className="size-5 text-muted-foreground" />
                {applications.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending decisions</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="size-5 text-muted-foreground" />
                {pendingDecisions}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Needs manual attention</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <TriangleAlert className="size-5 text-muted-foreground" />
                {failedNotifications}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="min-h-[560px]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Application requests</CardTitle>
                <CardDescription className="mt-2">
                  Open a request to review details and send the assessment invite.
                </CardDescription>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setApplicationPage(1);
                  }}
                  placeholder="Search candidate, job, status"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Candidate</th>
                      <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading
                      ? Array.from({ length: 6 }).map((_, index) => (
                          <tr key={index}>
                            {Array.from({ length: 5 }).map((__, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-4">
                                <div className="h-4 w-full max-w-40 animate-pulse rounded bg-muted" />
                                {cellIndex === 0 ? (
                                  <div className="mt-2 h-3 w-28 animate-pulse rounded bg-muted" />
                                ) : null}
                              </td>
                            ))}
                          </tr>
                        ))
                      : filteredApplications
                          .slice(
                            (Math.min(
                              applicationPage,
                              Math.max(
                                1,
                                Math.ceil(filteredApplications.length / APPLICATIONS_PER_PAGE),
                              ),
                            ) -
                              1) *
                              APPLICATIONS_PER_PAGE,
                            Math.min(
                              applicationPage,
                              Math.max(
                                1,
                                Math.ceil(filteredApplications.length / APPLICATIONS_PER_PAGE),
                              ),
                            ) * APPLICATIONS_PER_PAGE,
                          )
                          .map((application) => (
                          <tr
                            key={application.id}
                            className="bg-background align-top transition hover:bg-muted/30"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{application.candidateName}</p>
                              <p className="mt-1 max-w-sm truncate text-xs text-muted-foreground">
                                {application.candidateEmail}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{application.jobTitle}</p>
                              <Button asChild variant="link" className="h-auto p-0 text-xs">
                                <Link href={`/admin/jobs/${application.jobId}`}>
                                  Open job
                                </Link>
                              </Button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant={
                                    application.decisionStatus === "rejected"
                                      ? "outline"
                                      : "secondary"
                                  }
                                  className={
                                    application.decisionStatus === "rejected"
                                      ? "border-destructive/30 bg-destructive/10 text-destructive capitalize"
                                      : "capitalize"
                                  }
                                >
                                  {application.decisionStatus}
                                </Badge>
                                {/* {application.emailStatus === "failed" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-destructive/30 bg-destructive/10 text-destructive"
                                  >
                                    Email Failed
                                  </Badge>
                                ) : null} */}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <CalendarClock className="size-3.5" />
                                <span>{formatDate(application.createdAt)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <Link
                                  href={`/admin/candidate-applications/${application.id}`}
                                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground hover:text-black"
                                >
                                  <span className="relative block w-fit after:absolute after:left-0 after:bottom-0 after:block after:h-[1px] after:w-full after:origin-center after:scale-x-0 after:bg-current after:transition after:duration-300 after:content-[''] hover:after:scale-x-100">
                                    Review
                                  </span>
                                </Link>
                               
                              </div>
                            </td>
                          </tr>
                        ))}
                    {!isLoading && !filteredApplications.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <div className="mx-auto max-w-sm space-y-2">
                            <Loader2 className="mx-auto size-5 text-muted-foreground" />
                            <p className="text-sm font-medium">No applications found</p>
                            <p className="text-sm text-muted-foreground">
                              Public job applications will appear here after candidates submit
                              from the jobs page.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            {!isLoading && filteredApplications.length ? (
              <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page{" "}
                  {Math.min(
                    applicationPage,
                    Math.max(1, Math.ceil(filteredApplications.length / APPLICATIONS_PER_PAGE)),
                  )}{" "}
                  of {Math.max(1, Math.ceil(filteredApplications.length / APPLICATIONS_PER_PAGE))} -{" "}
                  {filteredApplications.length} applications
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applicationPage <= 1}
                    onClick={() => setApplicationPage((page) => Math.max(1, page - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      applicationPage >=
                      Math.max(1, Math.ceil(filteredApplications.length / APPLICATIONS_PER_PAGE))
                    }
                    onClick={() =>
                      setApplicationPage((page) =>
                        Math.min(
                          Math.max(1, Math.ceil(filteredApplications.length / APPLICATIONS_PER_PAGE)),
                          page + 1,
                        ),
                      )
                    }
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );

  async function rejectApplication(applicationId: string) {
    setRejectingApplicationId(applicationId);

    try {
      const response = await fetch(`/api/admin/candidate-applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const payload = (await response.json()) as ApplicationActionResponse;

      if (!response.ok || !payload.application) {
        throw new Error(payload.message ?? "Could not reject candidate application.");
      }

      setApplications((current) =>
        current.map((application) =>
          application.id === payload.application!.id ? payload.application! : application,
        ),
      );

      if (payload.mail?.sent === false) {
        toast.warning(payload.message ?? "Application rejected, but email failed.");
      } else {
        toast.success(payload.message ?? "Rejection email sent to the candidate.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not reject candidate application.",
      );
    } finally {
      setRejectingApplicationId("");
    }
  }
}
