"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  ShieldAlert,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildAssessmentSectionsFromResource,
  type SectionQuestionTypeConfig,
} from "@/features/test/assessment-resources";
import {
  readAdminDataSnapshot,
  subscribeToAdminData,
  updateAssessmentReview,
  type AssessmentResult,
  type JobAssessment,
} from "@/features/test/admin-storage";

type AdminSnapshot = {
  jobs?: JobAssessment[];
  results?: AssessmentResult[];
};

type SubmissionAction = "accepted" | "rejected" | "forwarded";

type SubmissionEmailResponse = {
  message?: string;
  mail?: { sent?: boolean; reason?: string | null };
};

const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function useAdminData() {
  const snapshot = useSyncExternalStore(
    subscribeToAdminData,
    readAdminDataSnapshot,
    () => "{}",
  );
  const data = JSON.parse(snapshot) as AdminSnapshot;

  return {
    jobs: data.jobs ?? [],
    results: data.results ?? [],
  };
}

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

function buildSubmissionLink(submission: AssessmentResult) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/admin/submissions/${submission.id}`;
}

function buildEmailBody({
  submission,
  remark,
  action,
}: {
  submission: AssessmentResult;
  remark: string;
  action: SubmissionAction;
}) {
  const heading =
    action === "accepted"
      ? "This candidate has been accepted for the next hiring stage."
      : action === "rejected"
        ? "This candidate has not been selected for the next hiring stage."
        : "Please review this candidate submission.";

  return [
    heading,
    "",
    `Candidate: ${submission.candidateName}`,
    `Email: ${submission.candidateEmail}`,
    `Assessment: ${submission.assessmentTitle}`,
    `Score: ${submission.score}%`,
    `Status: ${submission.status}`,
    `Answered: ${submission.answeredCount}/${submission.totalQuestions}`,
    `Violations: ${submission.violations.length}`,
    "",
    `Admin remark: ${remark || "No remark added."}`,
    "",
    `Submission link: ${buildSubmissionLink(submission)}`,
  ].join("\n");
}

export function AdminSubmissionDetail({ submissionId }: { submissionId: string }) {
  const { jobs, results } = useAdminData();
  const submission = results.find((result) => result.id === submissionId);
  const job = submission
    ? jobs.find((item) => item.id === submission.assessmentId)
    : undefined;
  const sections = useMemo(() => {
    if (!job) return [];

    return buildAssessmentSectionsFromResource({
      resourceId: job.resourceId,
      sectionCount: job.sectionCount,
      questionsPerSection: job.questionsPerSection,
      timePerSectionMinutes: job.timePerSectionMinutes,
      seed: job.id,
      sectionTypeConfigs: job.sectionTypeConfigs as
        | Record<string, SectionQuestionTypeConfig>
        | undefined,
    });
  }, [job]);
  const [activeSectionSlug, setActiveSectionSlug] = useState("");
  const [remark, setRemark] = useState(() => submission?.adminRemark ?? "");
  const [adminEmail, setAdminEmail] = useState("");
  const [sendingAction, setSendingAction] = useState<SubmissionAction | "evaluated" | null>(null);
  const activeSection =
    sections.find((section) => section.slug === activeSectionSlug) ?? sections[0];

  if (!submission) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AdminNavbar />
        <section className="mx-auto max-w-3xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Submission not found</CardTitle>
              <CardDescription>
                The selected candidate submission is not available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/submissions">Back to submissions</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const submissionRecord = submission;
  const textQuestions = sections.flatMap((section) =>
    section.questions.filter((question) => question.type === "text"),
  );
  const unreviewedTextCount = textQuestions.filter(
    (question) => submissionRecord.textScores?.[question.id] === undefined,
  ).length;

  function saveRemarkOnly() {
    updateAssessmentReview(submissionRecord.id, { adminRemark: remark });
    toast.success("Admin remark saved.");
  }

  function updateTextScore(questionId: string, value: string) {
    const score = Math.min(10, Math.max(0, Number(value)));
    updateAssessmentReview(submissionRecord.id, {
      textScores: { [questionId]: Number.isFinite(score) ? score : 0 },
      adminRemark: remark,
    });
  }

  async function sendSubmissionEmail({
    action,
    to,
    subject,
  }: {
    action: SubmissionAction;
    to: string;
    subject: string;
  }) {
    setSendingAction(action);
    updateAssessmentReview(submissionRecord.id, {
      decision: action,
      adminRemark: remark,
    });

    try {
      const response = await fetch("/api/admin/submission-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body: buildEmailBody({ submission: submissionRecord, remark, action }),
        }),
      });
      const payload = (await response.json()) as SubmissionEmailResponse;

      if (!response.ok || !payload.mail?.sent) {
        toast.error(payload.mail?.reason ?? payload.message ?? "Email could not be sent.");
        return;
      }

      toast.success("Email sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email could not be sent.");
    } finally {
      setSendingAction(null);
    }
  }

  function markEvaluated() {
    setSendingAction("evaluated");
    window.setTimeout(() => {
      updateAssessmentReview(submissionRecord.id, { adminRemark: remark });
      setSendingAction(null);
      toast.success("Submission marked as evaluated.");
    }, 500);
  }

  function sendAcceptanceEmail() {
    void sendSubmissionEmail({
      action: "accepted",
      to: submissionRecord.candidateEmail,
      subject: `KGM assessment update - ${submissionRecord.assessmentTitle}`,
    });
  }

  function sendRejectionEmail() {
    void sendSubmissionEmail({
      action: "rejected",
      to: submissionRecord.candidateEmail,
      subject: `KGM assessment result - ${submissionRecord.assessmentTitle}`,
    });
  }

  function forwardToAdmin() {
    if (!adminEmail.trim()) {
      toast.error("Enter admin email before forwarding.");
      return;
    }

    void sendSubmissionEmail({
      action: "forwarded",
      to: adminEmail.trim(),
      subject: `Candidate submission review - ${submissionRecord.candidateName}`,
    });
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button asChild variant="outline" className="mb-4">
              <Link href="/admin/submissions">
                <ArrowLeft className="size-4" />
                Back to submissions
              </Link>
            </Button>
            <Badge variant="secondary" className="mb-3 w-fit gap-2">
              <ShieldAlert className="size-3.5" />
              Individual submission
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              {submission.candidateName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {submission.assessmentTitle} · submitted {formatDate(submission.submittedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{submission.score}% score</Badge>
            <Badge variant={submission.status === "Submitted" ? "default" : "secondary"}>
              {submission.status}
            </Badge>
            <Badge variant={unreviewedTextCount ? "secondary" : "default"}>
              {unreviewedTextCount} text to review
            </Badge>
            <Badge variant="outline">{getReviewStatus(submission)}</Badge>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Section review</CardTitle>
                <CardDescription>
                  Open a section tab, review selected options, and mark written answers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.map((section, index) => {
                    const textToReview = section.questions.filter(
                      (question) =>
                        question.type === "text" &&
                        submission.textScores?.[question.id] === undefined,
                    ).length;
                    const isActive = section.slug === activeSection?.slug;

                    return (
                      <button
                        key={section.slug}
                        type="button"
                        className={[
                          "rounded-md border p-3 text-left transition",
                          isActive
                            ? "border-foreground bg-muted/50"
                            : "bg-background hover:bg-muted/40",
                        ].join(" ")}
                        onClick={() => setActiveSectionSlug(section.slug)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            Section-{roman[index] ?? index + 1}
                          </span>
                          <Badge variant={textToReview ? "secondary" : "outline"}>
                            {textToReview}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {section.title}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {activeSection ? (
                  <div className="space-y-4">
                    <div className="rounded-md border bg-muted/25 p-4">
                      <p className="text-sm font-medium">
                        {activeSection.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Section questions and candidate answers
                      </p>
                    </div>
                    {activeSection.questions.map((question, index) => {
                      const answer = submission.answers?.[question.id] ?? "";
                      const provided = answer.split("||").filter(Boolean).sort();
                      const expected =
                        question.type === "text"
                          ? []
                          : [...(question.correctAnswers ?? [])].sort();
                      const isCorrect =
                        question.type !== "text" &&
                        expected.length > 0 &&
                        expected.length === provided.length &&
                        expected.every((value, answerIndex) => value === provided[answerIndex]);
                      const tone =
                        question.type === "text"
                          ? "border-border bg-background"
                          : isCorrect
                            ? "border-emerald-500/35 bg-emerald-500/10"
                            : "border-red-500/35 bg-red-500/10";

                      return (
                        <div key={question.id} className={`rounded-lg border p-4 ${tone}`}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Question {index + 1}
                              </p>
                              <p className="mt-1 text-sm font-medium">
                                {question.prompt}
                              </p>
                            </div>
                            <Badge variant={question.type === "text" ? "outline" : isCorrect ? "default" : "secondary"}>
                              {question.type === "text"
                                ? "Manual text"
                                : isCorrect
                                  ? "Correct"
                                  : "Incorrect"}
                            </Badge>
                          </div>

                          {question.type === "text" ? (
                            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_180px]">
                              <div className="rounded-md border bg-muted/20 p-3">
                                <p className="text-xs text-muted-foreground">Candidate answer</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm font-medium">
                                  {answer || "No answer"}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`${question.id}-score`}>
                                  Marks out of 10
                                </Label>
                                <Input
                                  id={`${question.id}-score`}
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={submission.textScores?.[question.id] ?? ""}
                                  onChange={(event) =>
                                    updateTextScore(question.id, event.target.value)
                                  }
                                  placeholder="0-10"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              {question.options.map((option) => {
                                const selected = provided.includes(option);
                                const correct = expected.includes(option);
                                const optionTone =
                                  selected && correct
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                    : selected
                                      ? "border-red-500/40 bg-red-500/15 text-red-800 dark:text-red-300"
                                      : correct
                                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                        : "border-border bg-background text-muted-foreground";

                                return (
                                  <div
                                    key={option}
                                    className={`rounded-md border p-3 text-sm ${optionTone}`}
                                  >
                                    <span className="font-medium">{option}</span>
                                    <span className="ml-2 text-xs">
                                      {selected && correct
                                        ? "Selected - correct"
                                        : selected
                                          ? "Selected - incorrect"
                                          : correct
                                            ? "Correct answer"
                                            : "Not selected"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No section data is available for this submission.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review actions</CardTitle>
                <CardDescription>
                  Save remark, mark evaluation, and send candidate/admin emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Candidate email</p>
                    <p className="font-medium">{submission.candidateEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Answered</p>
                    <p className="font-medium">
                      {submission.answeredCount}/{submission.totalQuestions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Violations</p>
                    <p className="font-medium">{submission.violations.length}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-remark">Admin remark</Label>
                  <Textarea
                    id="admin-remark"
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    placeholder="Write remark included in emails..."
                  />
                  <Button type="button" variant="outline" onClick={saveRemarkOnly}>
                    Save remark
                  </Button>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={markEvaluated}
                  disabled={Boolean(sendingAction)}
                >
                  {sendingAction === "evaluated" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Mark evaluated
                </Button>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendAcceptanceEmail}
                    disabled={Boolean(sendingAction)}
                  >
                    {sendingAction === "accepted" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Acceptance email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendRejectionEmail}
                    disabled={Boolean(sendingAction)}
                  >
                    {sendingAction === "rejected" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    Rejection email
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <Label htmlFor="share-admin">Forward to admin</Label>
                  <Input
                    id="share-admin"
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder="admin@example.com"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={forwardToAdmin}
                    disabled={Boolean(sendingAction)}
                  >
                    {sendingAction === "forwarded" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    Forward with remark
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Violation timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {submission.violations.length ? (
                  submission.violations.map((violation, index) => (
                    <div key={violation.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                      <p className="font-medium">#{index + 1} {violation.sectionTitle}</p>
                      <p className="mt-1 text-muted-foreground">{violation.reason}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(violation.occurredAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No violations recorded.
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}
