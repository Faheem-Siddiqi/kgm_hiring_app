"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
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
import { Label } from "@/components/ui/label";
import {
  type AssessmentResult,
  type JobAssessment,
} from "@/features/test/admin-storage";
import {
  buildAssessmentSectionsFromResource,
  type SectionQuestionTypeConfig,
} from "@/features/test/assessment-resources";
import type { PublicAssessment } from "@/lib/assessment-types";

type AdminSnapshot = {
  jobs?: JobAssessment[];
  submission?: AssessmentResult | null;
  isLoading: boolean;
  notFound: boolean;
};

type SubmissionAction = "accepted" | "rejected" | "forwarded";

type SubmissionEmailResponse = {
  message?: string;
  mail?: { sent?: boolean; reason?: string | null };
};

const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function useAdminData(submissionId: string) {
  const [data, setData] = useState<AdminSnapshot>({
    isLoading: true,
    notFound: false,
  });

  useEffect(() => {
    let active = true;

    async function loadData() {
      setData((current) => ({ ...current, isLoading: true, notFound: false }));

      try {
        const [submissionResponse, assessmentsResponse] = await Promise.all([
          fetch(`/api/admin/submissions/${submissionId}`, { cache: "no-store" }),
          fetch("/api/admin/assessments", { cache: "no-store" }),
        ]);
        const submissionData = (await submissionResponse.json()) as {
          message?: string;
          submission?: AssessmentResult;
        };
        const assessmentData = (await assessmentsResponse.json()) as {
          message?: string;
          assessments?: PublicAssessment[];
        };

        if (submissionResponse.status === 404) {
          if (active) {
            setData({
              jobs: [],
              submission: null,
              isLoading: false,
              notFound: true,
            });
          }
          return;
        }

        if (!submissionResponse.ok) {
          throw new Error(submissionData.message ?? "Could not load submission.");
        }

        if (!assessmentsResponse.ok) {
          throw new Error(assessmentData.message ?? "Could not load assessments.");
        }

        if (!active) return;

        setData({
          submission: submissionData.submission ?? null,
          isLoading: false,
          notFound: !submissionData.submission,
          jobs: (assessmentData.assessments ?? []).map((assessment) => {
            const sectionTypeConfigs = Object.fromEntries(
              assessment.sectionSettings.map((section) => [
                section.sectionId,
                section.types,
              ]),
            ) as Record<string, SectionQuestionTypeConfig>;
            const questionsPerSection = Math.max(
              1,
              ...assessment.sectionSettings.map(
                (section) =>
                  section.types.mcq.quantity +
                  section.types.multi.quantity +
                  section.types.text.quantity,
              ),
            );
            const timePerSectionMinutes = Math.max(
              1,
              ...assessment.sectionSettings.map((section) =>
                Math.ceil(
                  Math.max(
                    section.types.mcq.timeLimitSeconds,
                    section.types.multi.timeLimitSeconds,
                    section.types.text.timeLimitSeconds,
                  ) / 60,
                ),
              ),
            );

            return {
              id: assessment.id,
              title: assessment.name,
              role: assessment.questionBankName,
              createdAt: assessment.createdAt,
              resourceId: assessment.questionBankId,
              sectionCount: assessment.sectionCount,
              timePerSectionMinutes,
              questionsPerTest: assessment.totalQuestions,
              questionsPerSection,
              sectionTypeConfigs,
            };
          }),
        });
      } catch (error) {
        if (active) {
          setData((current) => ({ ...current, isLoading: false }));
        }
        toast.error(error instanceof Error ? error.message : "Could not load submission.");
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [submissionId]);

  return {
    jobs: data.jobs ?? [],
    submission: data.submission ?? null,
    isLoading: data.isLoading,
    notFound: data.notFound,
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
  action,
}: {
  submission: AssessmentResult;
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
    `Violations: ${submission.violations?.length ?? 0}`,
    "",
    // `Submission link: ${buildSubmissionLink(submission)}`
    // ,
  ].join("\n");
}

function SubmissionDetailSkeleton() {
  const block = (className: string) => (
    <div className={`animate-pulse rounded-md bg-muted ${className}`} />
  );

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            {block("h-10 w-40")}
            {block("h-6 w-36")}
            {block("h-10 w-72")}
            {block("h-4 w-[min(560px,80vw)]")}
            <div className="rounded-md border p-4">
              {block("h-4 w-44")}
              {block("mt-3 h-4 w-64")}
              {block("mt-4 h-16 w-full")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {block("h-6 w-24")}
            {block("h-6 w-28")}
            {block("h-6 w-32")}
            {block("h-6 w-28")}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader className="space-y-3">
              {block("h-6 w-40")}
              {block("h-4 w-80")}
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-md border p-3">
                    {block("h-4 w-24")}
                    {block("mt-3 h-3 w-full")}
                  </div>
                ))}
              </div>
              <div className="rounded-md border p-4">
                {block("h-5 w-52")}
                {block("mt-3 h-4 w-72")}
              </div>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-4">
                  {block("h-3 w-24")}
                  {block("mt-3 h-5 w-11/12")}
                  {block("mt-5 h-24 w-full")}
                </div>
              ))}
            </CardContent>
          </Card>

          <aside className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                {block("h-6 w-32")}
                {block("h-4 w-64")}
              </CardHeader>
              <CardContent className="space-y-4">
                {block("h-28 w-full")}
                {block("h-24 w-full")}
                {block("h-10 w-full")}
                {block("h-10 w-full")}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>{block("h-6 w-36")}</CardHeader>
              <CardContent className="space-y-2">
                {block("h-16 w-full")}
                {block("h-16 w-full")}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}

export function AdminSubmissionDetail({ submissionId }: { submissionId: string }) {
  const { jobs, submission: loadedSubmission, isLoading, notFound } = useAdminData(submissionId);
  const [submissionOverride, setSubmissionOverride] = useState<AssessmentResult | null>(null);
  const submission =
    submissionOverride?.id === submissionId ? submissionOverride : loadedSubmission;
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
  const [adminEmail, setAdminEmail] = useState("");
  const [textScoreDrafts, setTextScoreDrafts] = useState<Record<string, number>>({});
  const [sendingAction, setSendingAction] = useState<SubmissionAction | "evaluated" | null>(null);
  const activeSection =
    sections.find((section) => section.slug === activeSectionSlug) ?? sections[0];

  useEffect(() => {
    let cancelled = false;
    const nextDrafts = submission?.textScores ?? {};

    queueMicrotask(() => {
      if (!cancelled) {
        setTextScoreDrafts(nextDrafts);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [submission?.id, submission?.textScores]);

  if (isLoading) {
    return <SubmissionDetailSkeleton />;
  }

  if (!submission && notFound) {
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

  if (!submission) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AdminNavbar />
        <section className="mx-auto max-w-3xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Submission unavailable</CardTitle>
              <CardDescription>
                The submission could not be loaded. Please refresh or try again.
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
  const terminalDecision = submissionRecord.decision;
  const reviewLocked = Boolean(terminalDecision);
  const evaluationLocked = Boolean(submissionRecord.evaluatedAt);
  const textQuestions = sections.flatMap((section) =>
    section.questions.filter((question) => question.type === "text"),
  );
  const unreviewedTextCount = textQuestions.filter(
    (question) => submissionRecord.textScores?.[question.id] === undefined,
  ).length;

  async function saveReview(
    action: SubmissionAction | "evaluated",
    updates: { textScores?: Record<string, number> } = {},
  ) {
    setSendingAction(action);
    try {
      const response = await fetch(`/api/admin/submissions/${submissionRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          textScores: updates.textScores,
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        submission?: AssessmentResult;
      };

      if (!response.ok || !payload.submission) {
        throw new Error(payload.message ?? "Review could not be saved.");
      }

      setSubmissionOverride(payload.submission);
      toast.success(action === "evaluated" ? "Review saved." : "Review action saved.");
      return payload.submission;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review could not be saved.");
      return null;
    } finally {
      setSendingAction(null);
    }
  }

  function updateTextScore(questionId: string, value: string) {
    const score = Math.min(10, Math.max(0, Number(value)));
    setTextScoreDrafts((current) => ({
      ...current,
      [questionId]: Number.isFinite(score) ? score : 0,
    }));
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
    if (reviewLocked || evaluationLocked) {
      toast.error(
        evaluationLocked
          ? "This submission has already been evaluated."
          : "This submission already has a final review decision.",
      );
      return;
    }

    setSendingAction(action);
    const reviewedSubmission = await saveReview(action);
    if (!reviewedSubmission) return;

    try {
      const response = await fetch("/api/admin/submission-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body: buildEmailBody({ submission: reviewedSubmission, action }),
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
    if (reviewLocked) {
      toast.error("This submission already has a final review decision.");
      return;
    }

    void saveReview("evaluated", { textScores: textScoreDrafts });
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
            <Button asChild variant="outline" className="mb-6 ">
              <Link href="/admin/submissions">
                <ArrowLeft className="size-4" />
                Back to submissions
              </Link>
            </Button>
            {/* <Badge variant="secondary" className="mb-3 w-fit gap-1">
              <ShieldAlert className="size-3.5" />
              Individual submission
            </Badge> */}
            <h1 className="text-3xl font-semibold tracking-tight">
              {submission.candidateName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {submission.assessmentTitle} · submitted {formatDate(submission.submittedAt)}
            </p>
            {submission.evaluatedBy ? (
              <div className="mt-4 rounded-md border p-4 text-sm">
                <p className="font-medium">
                  Evaluated by {submission.evaluatedBy.name}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {submission.evaluatedBy.email}
                </p>
              </div>
            ) : null}
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
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
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
                        <p
                          className={[
                            "mt-1 line-clamp-2 text-xs",
                            isActive
                              ? "text-primary-foreground/85"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {section.title}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {activeSection ? (
                  <div className="space-y-4">
                    <div className="rounded-md border p-4">
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
                      const hasAnswer = provided.length > 0;
                      const isCorrect =
                        question.type !== "text" &&
                        hasAnswer &&
                        expected.length > 0 &&
                        expected.length === provided.length &&
                        expected.every((value, answerIndex) => value === provided[answerIndex]);

                      return (
                        <div key={question.id} className="rounded-lg border p-4">
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
                                  : hasAnswer
                                    ? "Incorrect"
                                    : "Unattempted"}
                            </Badge>
                          </div>

                          {question.type === "text" ? (
                            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_180px]">
                              <div className="rounded-md border p-3">
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
                                  value={textScoreDrafts[question.id] ?? ""}
                                  disabled={evaluationLocked || reviewLocked}
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
                                  !hasAnswer
                                    ? correct
                                      ? "border-primary/40 bg-primary/10 text-primary"
                                      : "border-border bg-background text-muted-foreground"
                                    : selected && correct
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
                                      {!hasAnswer
                                        ? correct
                                          ? "Correct answer"
                                          : "Unattempted"
                                        : selected && correct
                                          ? "Selected"
                                          : selected
                                            ? "Selected"
                                            : correct
                                              ? ""
                                              : ""}
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
                  Mark evaluation, send the final candidate email, or forward to another admin.
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

                <Button
                  type="button"
                  className="w-full"
                  onClick={markEvaluated}
                  disabled={Boolean(sendingAction) || reviewLocked || evaluationLocked}
                >
                  {sendingAction === "evaluated" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {submission.evaluatedAt ? "Evaluated" : "Mark evaluated"}
                </Button>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendAcceptanceEmail}
                    disabled={Boolean(sendingAction) || reviewLocked}
                  >
                    {sendingAction === "accepted" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {terminalDecision === "accepted" ? "Accepted" : "Acceptance email"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendRejectionEmail}
                    disabled={Boolean(sendingAction) || reviewLocked}
                  >
                    {sendingAction === "rejected" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    {terminalDecision === "rejected" ? "Rejected" : "Rejection email"}
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
                    disabled={Boolean(sendingAction) || reviewLocked}
                  >
                    {sendingAction === "forwarded" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    {terminalDecision === "forwarded" ? "Forwarded" : "Forward to admin"}
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
