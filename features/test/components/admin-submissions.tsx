"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  Files,
  Search,
  Send,
  Menu,
  ShieldAlert,
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
import {
  fetchAdminDataSnapshot,
  type AssessmentResult,
} from "@/features/test/admin-storage";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getReviewStatus(submission: AssessmentResult) {
  if (submission.decision === "accepted") return "Accepted";
  if (submission.decision === "rejected") return "Rejected";
  if (submission.decision === "forwarded") return "Forwarded";
  if (submission.evaluatedAt) return "Evaluated";
  return "Pending review";
}

function getReviewTone(status: string) {
  if (status === "Accepted" || status === "Evaluated") return "default";
  if (status === "Rejected") return "secondary";
  return "outline";
}

function buildSubmissionLink(submission: AssessmentResult) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/admin/submissions/${submission.id}`;
}

function buildShareBody(submission: AssessmentResult) {
  const reviewLink = buildSubmissionLink(submission);
  const reviewStatus = getReviewStatus(submission);

  return [
    "Please review this candidate submission.",
    "",
    `Candidate: ${submission.candidateName}`,
    `Email: ${submission.candidateEmail}`,
    `Assessment: ${submission.assessmentTitle}`,
    `Score: ${submission.score}%`,
    `Submission status: ${submission.status}`,
    `Review status: ${reviewStatus}`,
    `Answered: ${submission.answeredCount}/${submission.totalQuestions}`,
    `Violations: ${submission.violations.length}`,
    "",
    `Submission link: ${reviewLink}`,
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");
}

export function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<AssessmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [shareEmails, setShareEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadSubmissions() {
      try {
        const data = await fetchAdminDataSnapshot();
        if (active) setSubmissions(data.results);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load submissions.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadSubmissions();

    return () => {
      active = false;
    };
  }, []);

  const filteredSubmissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return submissions;

    return submissions.filter((submission) =>
      [
        submission.candidateName,
        submission.candidateEmail,
        submission.assessmentTitle,
        submission.status,
        getReviewStatus(submission),
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [searchQuery, submissions]);

  const pendingCount = submissions.filter(
    (submission) => getReviewStatus(submission) === "Pending review",
  ).length;
  const evaluatedCount = submissions.filter((submission) => submission.evaluatedAt).length;
  const averageScore = submissions.length
    ? Math.round(
        submissions.reduce((total, submission) => total + submission.score, 0) /
          submissions.length,
      )
    : 0;

  function updateShareEmail(submissionId: string, value: string) {
    setShareEmails((current) => ({ ...current, [submissionId]: value }));
  }

  function shareSubmission(submission: AssessmentResult) {
    const email = shareEmails[submission.id]?.trim();

    if (!email) {
      toast.error("Enter an admin email before sharing.");
      return;
    }

    const subject = `Candidate submission review - ${submission.candidateName}`;
    const body = buildShareBody(submission);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />

      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 w-fit gap-2">
              <Files className="size-3.5" />
              Submissions
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              Candidate submissions
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review all submitted assessments, track evaluation status, and
              share candidate submissions with another admin.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total", value: submissions.length, icon: Send },
            { label: "Pending", value: pendingCount, icon: Clock },
            { label: "Evaluated", value: evaluatedCount, icon: CheckCircle2 },
            { label: "Avg. score", value: `${averageScore}%`, icon: ShieldAlert },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <Icon className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="gap-4 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All submissions</CardTitle>
              <CardDescription>
                Click a row to open the full candidate submission review.
              </CardDescription>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
                placeholder="Search candidate, email, assessment, status"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-5">
            {filteredSubmissions.map((submission) => {
              const reviewStatus = getReviewStatus(submission);

              return (
                <div key={submission.id} className="rounded-md border p-4">
                  <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-start">
                    <Link
                      href={`/admin/submissions/${submission.id}`}
                      className="min-w-0 space-y-3 rounded-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {submission.candidateName}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {submission.candidateEmail}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {submission.assessmentTitle} · submitted{" "}
                            {formatDate(submission.submittedAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={submission.status === "Submitted" ? "default" : "secondary"}>
                            {submission.status}
                          </Badge>
                          <Badge variant={getReviewTone(reviewStatus)}>
                            {reviewStatus}
                          </Badge>
                          <Badge variant="outline">{submission.score}%</Badge>
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm sm:grid-cols-3">
                        <div className="rounded-md bg-muted/35 p-3">
                          <p className="text-xs text-muted-foreground">Answered</p>
                          <p className="font-medium">
                            {submission.answeredCount}/{submission.totalQuestions}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/35 p-3">
                          <p className="text-xs text-muted-foreground">Violations</p>
                          <p className="font-medium">{submission.violations.length}</p>
                        </div>
                        <div className="rounded-md bg-muted/35 p-3">
                          <p className="text-xs text-muted-foreground">Decision</p>
                          <p className="font-medium capitalize">
                            {submission.decision ?? "none"}
                          </p>
                        </div>
                      </div>
                    </Link>

                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="mb-2 text-sm font-medium">Share with admin</p>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input
                          type="email"
                          value={shareEmails[submission.id] ?? ""}
                          onChange={(event) =>
                            updateShareEmail(submission.id, event.target.value)
                          }
                          placeholder="admin@example.com"
                        />
                        <Button
                          type="button"
                          onClick={() => shareSubmission(submission)}
                        >
                          <Mail className="size-4" />
                          Share
                        </Button>
                      </div>
                      <Button asChild className="mt-2 w-full" variant="outline">
                        <Link href={`/admin/submissions/${submission.id}`}>
                          Open submission
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading ? (
              <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                Loading submissions...
              </div>
            ) : null}

            {!isLoading && !filteredSubmissions.length ? (
              <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                No submissions found.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
