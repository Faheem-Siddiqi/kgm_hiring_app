"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  Send,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
import { Progress } from "@/components/ui/progress";
import {
  createCandidate,
  readAdminDataSnapshot,
  subscribeToAdminData,
  saveSectionQuestionTypeConfigs,
  type AssessmentResult,
  type Candidate,
  type JobAssessment,
} from "@/features/test/admin-storage";
import {
  assessmentResourceSummaries,
  buildAssessmentSectionsFromResource,
  type SectionQuestionTypeConfig,
} from "@/features/test/assessment-resources";

type AdminSnapshot = {
  candidates?: Candidate[];
  jobs?: JobAssessment[];
  results?: AssessmentResult[];
};

function useAdminData() {
  const snapshot = useSyncExternalStore(
    subscribeToAdminData,
    readAdminDataSnapshot,
    () => "{}",
  );
  const adminData = JSON.parse(snapshot) as AdminSnapshot;

  return {
    candidates: adminData.candidates ?? [],
    jobs: adminData.jobs ?? [],
    results: adminData.results ?? [],
  };
}

function getAverageScore(results: AssessmentResult[]) {
  if (!results.length) {
    return 0;
  }

  return Math.round(
    results.reduce((total, result) => total + result.score, 0) /
      results.length,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AssessmentAnalytics({ assessmentId }: { assessmentId: string }) {
  const [selectedCvUrl, setSelectedCvUrl] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<Record<string, SectionQuestionTypeConfig>>({});
  const [savedSettings, setSavedSettings] = useState<Record<string, SectionQuestionTypeConfig>>({});
  const [settingsDirty, setSettingsDirty] = useState(false);
  const searchParams = useSearchParams();
  const { candidates, jobs, results } = useAdminData();
  const assessment = jobs.find((job) => job.id === assessmentId);
  const assessmentCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.jobId === assessmentId),
    [assessmentId, candidates],
  );
  const assessmentResults = useMemo(
    () => results.filter((result) => result.assessmentId === assessmentId),
    [assessmentId, results],
  );
  const topCandidates = useMemo(
    () => [...assessmentResults].sort((a, b) => b.score - a.score).slice(0, 5),
    [assessmentResults],
  );
  const averageScore = getAverageScore(assessmentResults);
  const completionRate = assessmentCandidates.length
    ? Math.round((assessmentResults.length / assessmentCandidates.length) * 100)
    : 0;
  const autoSubmittedCount = assessmentResults.filter(
    (result) => result.status === "Auto submitted",
  ).length;
  const scoreBands = [
    {
      label: "90-100",
      count: assessmentResults.filter((result) => result.score >= 90).length,
    },
    {
      label: "70-89",
      count: assessmentResults.filter(
        (result) => result.score >= 70 && result.score < 90,
      ).length,
    },
    {
      label: "50-69",
      count: assessmentResults.filter(
        (result) => result.score >= 50 && result.score < 70,
      ).length,
    },
    {
      label: "0-49",
      count: assessmentResults.filter((result) => result.score < 50).length,
    },
  ];
  const maxBandCount = Math.max(...scoreBands.map((band) => band.count), 1);
  const selectedSubmission =
    assessmentResults.find(
      (result) =>
        result.id === (selectedSubmissionId || searchParams.get("submission")),
    ) ?? assessmentResults[0];
  const selectedCv =
    selectedCvUrl ||
    assessmentCandidates[0]?.cvUrl ||
    "https://drive.google.com/file/d/sample-cv-preview/view";
  const resourceSummary = assessmentResourceSummaries.find(
    (resource) => resource.id === assessment?.resourceId,
  );
  const storedSettingsSnapshot = JSON.stringify(
    assessment?.sectionTypeConfigs ?? {},
  );
  const configuredSections = assessment
    ? buildAssessmentSectionsFromResource({
        resourceId: assessment.resourceId,
        sectionCount: assessment.sectionCount,
        questionsPerSection: assessment.questionsPerSection,
        timePerSectionMinutes: assessment.timePerSectionMinutes,
        seed: assessment.id,
        sectionTypeConfigs: assessment.sectionTypeConfigs,
      })
    : [];
  const submissionQuestions = configuredSections.flatMap((section) =>
    section.questions.map((question) => ({ ...question, sectionTitle: section.title })),
  );

  useEffect(() => {
    const defaults = Object.fromEntries(
      (resourceSummary?.sections ?? []).map((section) => [
        section.id,
        {
          mcq: { quantity: Math.min(3, section.counts.mcq), timeLimitSeconds: 60 },
          multi: { quantity: Math.min(3, section.counts.multi), timeLimitSeconds: 90 },
          text: { quantity: Math.min(3, section.counts.text), timeLimitSeconds: 180 },
        },
      ]),
    );
    const storedSettings = JSON.parse(storedSettingsSnapshot) as Record<
      string,
      SectionQuestionTypeConfig
    >;
    const nextSettings = { ...defaults, ...storedSettings };
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSettingsDraft(nextSettings);
      setSavedSettings(nextSettings);
      setSettingsDirty(false);
    });

    return () => {
      cancelled = true;
    };
  }, [assessmentId, resourceSummary, storedSettingsSnapshot]);

  function updateSettingsDraft(
    sectionId: string,
    type: keyof SectionQuestionTypeConfig,
    field: "quantity" | "timeLimitSeconds",
    value: number,
  ) {
    setSettingsDraft((current) => ({
      ...current,
      [sectionId]: {
        ...current[sectionId],
        [type]: { ...current[sectionId][type], [field]: value },
      },
    }));
    setSettingsDirty(true);
  }

  function saveSettings() {
    if (!assessment) return;
    saveSectionQuestionTypeConfigs(assessment.id, settingsDraft);
    setSavedSettings(settingsDraft);
    setSettingsDirty(false);
    toast.success("Question settings saved");
  }

  function handleSendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!candidateName.trim() || !candidateEmail.trim()) {
      toast.error("Candidate name and email are required");
      return;
    }

    const candidate = createCandidate(
      candidateName.trim(),
      candidateEmail.trim(),
      assessmentId,
    );
    setCandidateName("");
    setCandidateEmail("");
    toast.success(`Invite email prepared for ${candidate.email}`);
  }

  if (!assessment) {
    return (
      <main className="min-h-svh bg-background px-4 py-10 text-foreground">
        <section className="mx-auto max-w-3xl space-y-4">
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Assessment not found</CardTitle>
              <CardDescription>
                This assessment may have been removed from local admin data.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href="/admin" aria-label="Back to dashboard">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">
                {assessment.role}
              </p>
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {assessment.title}
              </h1>
            </div>
          </div>
          <Button asChild>
            <Link href="/test">
              Candidate test
              <ExternalLink className="size-4" />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Invited",
              value: assessmentCandidates.length,
              icon: Users,
            },
            {
              label: "Completed",
              value: `${completionRate}%`,
              icon: CheckCircle2,
            },
            {
              label: "Average score",
              value: `${averageScore}%`,
              icon: BarChart3,
            },
            {
              label: "Auto submitted",
              value: autoSubmittedCount,
              icon: Clock,
            },
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

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Score distribution</CardTitle>
              <CardDescription>
                Candidate performance bands for this assessment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {scoreBands.map((band) => (
                <div key={band.label} className="grid grid-cols-[64px_1fr_40px] items-center gap-3">
                  <span className="text-sm text-muted-foreground">{band.label}</span>
                  <div className="h-8 overflow-hidden rounded-md border bg-muted">
                    <div
                      className="h-full bg-foreground"
                      style={{
                        width: `${Math.max((band.count / maxBandCount) * 100, band.count ? 8 : 0)}%`,
                      }}
                    />
                  </div>
                  <span className="text-right text-sm font-medium">{band.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top candidates</CardTitle>
              <CardDescription>
                Highest scoring submissions for this assessment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topCandidates.length ? (
                topCandidates.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="w-full space-y-2 rounded-md border p-3 text-left transition hover:bg-muted/40"
                    onClick={() => setSelectedSubmissionId(candidate.id)}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">
                        {index + 1}. {candidate.candidateName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {candidate.violations.length} violations
                        </Badge>
                        <Badge variant="secondary">{candidate.score}%</Badge>
                      </div>
                    </div>
                    <Progress value={candidate.score} />
                  </button>
                ))
              ) : (
                <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                  Top candidates will appear after submissions.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Invitation card</CardTitle>
              <CardDescription>
                Invite a candidate directly into this assessment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleSendInvite}>
                <div className="space-y-2">
                  <Label htmlFor="assessment-candidate-name">Candidate name</Label>
                  <Input
                    id="assessment-candidate-name"
                    value={candidateName}
                    onChange={(event) => setCandidateName(event.target.value)}
                    placeholder="Candidate name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assessment-candidate-email">Email</Label>
                  <Input
                    id="assessment-candidate-email"
                    type="email"
                    value={candidateEmail}
                    onChange={(event) => setCandidateEmail(event.target.value)}
                    placeholder="candidate@example.com"
                  />
                </div>
                <Button className="self-end" type="submit">
                  <Send className="size-4" />
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Question type settings</CardTitle>
              <CardDescription>
                Set the quantity and time limit for each question type in every section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resourceSummary?.sections.slice(0, assessment.sectionCount).map((section) => (
                <div key={section.id} className="rounded-lg border p-4">
                  <p className="mb-4 font-medium">{section.title}</p>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {([
                      ["mcq", "Single choice"],
                      ["multi", "Multiple select"],
                      ["text", "Written response"],
                    ] as const).map(([type, label]) => {
                      const defaults = { mcq: 60, multi: 90, text: 180 };
                      const current = settingsDraft[section.id]?.[type];
                      return (
                        <div key={type} className="rounded-md bg-muted/35 p-3">
                          <p className="mb-3 text-sm font-medium">{label}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`${section.id}-${type}-quantity`}>Quantity</Label>
                              <Input id={`${section.id}-${type}-quantity`} type="number" min={0} max={section.counts[type]} value={current?.quantity ?? Math.min(3, section.counts[type])} onChange={(event) => updateSettingsDraft(section.id, type, "quantity", Math.min(section.counts[type], Math.max(0, Number(event.target.value))))} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${section.id}-${type}-time`}>Seconds each</Label>
                              <Input id={`${section.id}-${type}-time`} type="number" min={10} value={current?.timeLimitSeconds ?? defaults[type]} onChange={(event) => updateSettingsDraft(section.id, type, "timeLimitSeconds", Math.max(10, Number(event.target.value)))} />
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{section.counts[type]} available</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {settingsDirty ? "You have unsaved changes." : "All question settings are saved."}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!settingsDirty}
                    onClick={() => {
                      setSettingsDraft(savedSettings);
                      setSettingsDirty(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" disabled={!settingsDirty} onClick={saveSettings}>
                    Save settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Candidates</CardTitle>
              <CardDescription>
                Invite details, OTP code, result status, and CV preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assessmentCandidates.map((candidate) => {
                const result = assessmentResults.find(
                  (item) => item.candidateEmail === candidate.email,
                );

                return (
                  <div key={candidate.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {candidate.email}
                        </p>
                      </div>
                      <Badge variant={result ? "default" : "outline"}>
                        {result ? `${result.score}%` : "Invited"}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-md bg-muted/40 p-3">
                        <Mail className="mb-2 size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">OTP</p>
                        <p className="font-medium">{candidate.otpCode}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-3">
                        <Clock className="mb-2 size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Invited</p>
                        <p className="font-medium">{formatDate(candidate.invitedAt)}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-3">
                        <FileText className="mb-2 size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">CV</p>
                        <Button
                          className="mt-1 h-auto p-0"
                          variant="link"
                          onClick={() => setSelectedCvUrl(candidate.cvUrl)}
                        >
                          Preview
                        </Button>
                      </div>
                    </div>
                    {result ? (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSubmissionId(result.id)}
                      >
                        View submission
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CV preview</CardTitle>
              <CardDescription>
                Drive links can be previewed in the same admin window.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border bg-muted/30">
                <iframe
                  title="Candidate CV preview"
                  src={selectedCv}
                  className="h-[480px] w-full bg-background"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submission log</CardTitle>
            <CardDescription>
              Pick a submission to view answers, status, and violations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assessmentResults.length ? (
              assessmentResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="grid w-full gap-3 rounded-md border p-4 text-left transition hover:bg-muted/40 md:grid-cols-[1fr_140px_140px_120px]"
                  onClick={() => setSelectedSubmissionId(result.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{result.candidateName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {result.candidateEmail}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {result.answeredCount}/{result.totalQuestions} answered
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.violations.length} violations
                  </p>
                  <Badge variant={result.status === "Submitted" ? "default" : "secondary"}>
                    {result.status}
                  </Badge>
                </button>
              ))
            ) : (
              <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                No submissions for this assessment yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Selected submission</CardTitle>
                <CardDescription>
                  Specific candidate submission details for admin review.
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <Settings2 className="size-3" />
                clickable
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {selectedSubmission ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Candidate</p>
                    <p className="font-medium">{selectedSubmission.candidateName}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Score</p>
                    <p className="font-medium">{selectedSubmission.score}%</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Answered</p>
                    <p className="font-medium">
                      {selectedSubmission.answeredCount}/{selectedSubmission.totalQuestions}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Violations</p>
                    <p className="font-medium">{selectedSubmission.violations.length}</p>
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <p className="mb-3 text-sm font-medium">Violation timeline</p>
                  {selectedSubmission.violations.length ? (
                    <div className="space-y-2">
                      {selectedSubmission.violations.map((violation, index) => (
                        <div
                          key={violation.id}
                          className="grid gap-2 rounded-md bg-muted/35 p-3 text-sm sm:grid-cols-[80px_1fr_180px]"
                        >
                          <span className="font-medium">
                            #{String(index + 1).padStart(2, "0")}
                          </span>
                          <span>
                            {violation.sectionTitle}: {violation.reason}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(violation.occurredAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No violations were recorded for this submission.
                    </p>
                  )}
                </div>
                <div className="rounded-md border p-4">
                  <div className="mb-4">
                    <p className="text-sm font-medium">Answer review</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Objective responses are checked automatically. Written responses require manual review.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {submissionQuestions.map((question, index) => {
                      const answer = selectedSubmission.answers?.[question.id] ?? "";
                      const provided = answer.split("||").filter(Boolean).sort();
                      const expected = question.type === "text" ? [] : [...(question.correctAnswers ?? [])].sort();
                      const isCorrect = question.type !== "text" && expected.length > 0 && expected.length === provided.length && expected.every((value, answerIndex) => value === provided[answerIndex]);
                      const correctSelections = provided.filter((value) => expected.includes(value)).length;
                      const incorrectSelections = provided.filter((value) => !expected.includes(value)).length;
                      const earnedPercent = question.type === "text" || !expected.length
                        ? 0
                        : question.type === "mcq"
                          ? (isCorrect ? 100 : 0)
                          : Math.round(Math.max(0, correctSelections / expected.length - incorrectSelections / expected.length) * 100);
                      const isPartial = earnedPercent > 0 && earnedPercent < 100;
                      const tone = question.type === "text"
                        ? "border-border bg-muted/25"
                        : isCorrect
                          ? "border-emerald-500/35 bg-emerald-500/10"
                          : isPartial
                            ? "border-amber-500/35 bg-amber-500/10"
                            : "border-red-500/35 bg-red-500/10";

                      return (
                        <div key={question.id} className={`rounded-lg border p-4 ${tone}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">{question.sectionTitle} · Question {index + 1}</p>
                              <p className="mt-1 text-sm font-medium">{question.prompt}</p>
                            </div>
                            <Badge className={question.type === "text" ? "" : isCorrect ? "border-emerald-600/30 bg-emerald-600 text-white" : isPartial ? "border-amber-600/30 bg-amber-500 text-white" : "border-red-600/30 bg-red-600 text-white"} variant={question.type === "text" ? "outline" : "default"}>
                              {question.type === "text" ? "Manual review" : isCorrect ? "Correct - 100%" : isPartial ? `Partial - ${earnedPercent}%` : "Incorrect - 0%"}
                            </Badge>
                          </div>
                          {question.type === "text" ? (
                            <div className="mt-3 text-sm"><p className="text-xs text-muted-foreground">Candidate answer</p><p className="mt-1 whitespace-pre-wrap font-medium">{answer || "No answer"}</p></div>
                          ) : (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {question.options.map((option) => {
                                const selected = provided.includes(option);
                                const correct = expected.includes(option);
                                const optionTone = selected && correct
                                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                  : selected
                                    ? "border-red-500/40 bg-red-500/15 text-red-800 dark:text-red-300"
                                    : correct
                                      ? "border-emerald-500/35 text-emerald-700 dark:text-emerald-400"
                                      : "border-border bg-background text-muted-foreground";
                                return <div key={option} className={`rounded-md border p-3 text-sm ${optionTone}`}><span className="font-medium">{option}</span><span className="ml-2 text-xs">{selected && correct ? "Selected - correct" : selected ? "Selected - incorrect" : correct ? "Correct answer" : "Not selected"}</span></div>;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                No submission selected yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
