"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  ListChecks,
  Loader2,
  LogOut,
  PlayCircle,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  readActiveAssessmentSections,
  readActiveJobAssessment,
  readAssessmentResults,
  readCandidateAttempts,
  readCandidates,
  readJobAssessments,
  startOrResumeAssessmentAttempt,
  subscribeToAdminData,
  writeActiveJobAssessment,
  QUESTION_STATUS_STORAGE_KEY,
} from "@/features/test/admin-storage";
import { enterAssessmentFullscreen } from "@/features/test/assessment-fullscreen";
import {
  getAnsweredCount,
  getTotalQuestionCount,
  readStoredAnswersSnapshot,
  writeStoredAnswers,
} from "@/features/test/assessment-storage";

type SectionPreview = {
  slug: string;
  title?: string;
  name?: string;
  label?: string;
  time?: string;
  questionTimeSeconds?: number;
  questions: Array<{
    id: string;
    type?: "mcq" | "multi" | "text";
    timeLimitSeconds?: number;
  }>;
};

function subscribeToAnswers(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("kgm-hiring-assessment-answers-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(
      "kgm-hiring-assessment-answers-change",
      onStoreChange,
    );
  };
}

function subscribeToTestData(onStoreChange: () => void) {
  const unsubscribeAnswers = subscribeToAnswers(onStoreChange);
  const unsubscribeAdmin = subscribeToAdminData(onStoreChange);

  return () => {
    unsubscribeAnswers();
    unsubscribeAdmin();
  };
}

function formatDateTime(value?: string) {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not specified";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getSectionName(section: SectionPreview, index: number) {
  if (section.title) return section.title;
  if (section.name) return section.name;
  if (section.label) return section.label;

  return section.slug
    ? section.slug
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : `Section ${index + 1}`;
}

function getSectionTime(section: SectionPreview, fallbackMinutes: number) {
  const totalSeconds = section.questions.reduce(
    (sum, question) =>
      sum +
      Number(
        question.timeLimitSeconds ??
          section.questionTimeSeconds ??
          fallbackMinutes * 60,
      ),
    0,
  );

  if (totalSeconds > 0) {
    return `${Math.max(1, Math.ceil(totalSeconds / 60))} min`;
  }

  return `${fallbackMinutes} min`;
}

function getQuestionTypeLabel(section: SectionPreview) {
  const counts = section.questions.reduce(
    (next, question) => ({
      ...next,
      [question.type ?? "mcq"]: next[question.type ?? "mcq"] + 1,
    }),
    { mcq: 0, multi: 0, text: 0 },
  );

  const labels = [
    counts.mcq ? `MCQ ${counts.mcq}` : "",
    counts.multi ? `Multiple ${counts.multi}` : "",
    counts.text ? `Text ${counts.text}` : "",
  ].filter(Boolean);

  return labels.length ? labels.join(" / ") : "Mixed questions";
}

function getStatusMeta(
  status: "Submitted" | "Expired" | "In Progress" | "Not Started",
) {
  if (status === "Submitted") {
    return {
      label: "Submitted",
      buttonLabel: "Submitted",
      icon: CheckCircle2,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "Expired") {
    return {
      label: "Expired",
      buttonLabel: "Expired",
      icon: AlertTriangle,
      badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (status === "In Progress") {
    return {
      label: "In Progress",
      buttonLabel: "Continue Assessment",
      icon: TimerReset,
      badgeClass: "border-primary/20 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Not Started",
    buttonLabel: "Start Assessment",
    icon: PlayCircle,
    badgeClass: "border-primary/20 bg-primary/10 text-primary",
  };
}

export function TestOverview() {
  const router = useRouter();
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [openingTarget, setOpeningTarget] = useState<string | null>(null);

  const isOpeningSection = Boolean(openingTarget);

  const answersSnapshot = useSyncExternalStore(
    subscribeToTestData,
    readStoredAnswersSnapshot,
    () => "{}",
  );

  const answers = JSON.parse(answersSnapshot) as Record<string, string>;
  const activeAssessment = readActiveJobAssessment();

  const activeCandidateId =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("kgm-hiring-active-candidate-id");

  const activeCandidate = readCandidates().find(
    (candidate) => candidate.id === activeCandidateId,
  );

  const submittedAssessmentIds = new Set(
    readAssessmentResults()
      .filter((result) => result.candidateId === activeCandidateId)
      .map((result) => result.assessmentId),
  );

  const candidateAssessmentIds = activeCandidate?.assessmentIds?.length
    ? activeCandidate.assessmentIds
    : activeCandidate?.jobId
      ? [activeCandidate.jobId]
      : [];

  const candidateAssessments = readJobAssessments().filter((assessment) =>
    candidateAssessmentIds.includes(assessment.id),
  );

  const pendingCandidateAssessments = candidateAssessments.filter(
    (assessment) => !submittedAssessmentIds.has(assessment.id),
  );

  const attempts = readCandidateAttempts().filter(
    (attempt) => attempt.candidateId === activeCandidateId,
  );

  const inviteExpiryTime = activeCandidate?.inviteExpiresAt
    ? new Date(activeCandidate.inviteExpiresAt).getTime()
    : Number.POSITIVE_INFINITY;

  const [isInviteExpired, setIsInviteExpired] = useState(false);

  const activeSections = readActiveAssessmentSections() as SectionPreview[];
  const totalQuestions = getTotalQuestionCount();

  const answeredQuestions = getAnsweredCount(
    answers,
    activeSections.flatMap((section) =>
      section.questions.map((question) => question.id),
    ),
  );

  const completionPercent =
    totalQuestions > 0
      ? Math.round((answeredQuestions / totalQuestions) * 100)
      : 0;

  useEffect(() => {
    if (!Number.isFinite(inviteExpiryTime)) return;

    function updateInviteExpiry() {
      setIsInviteExpired(inviteExpiryTime <= Date.now());
    }

    updateInviteExpiry();

    const intervalId = window.setInterval(updateInviteExpiry, 1000);

    return () => window.clearInterval(intervalId);
  }, [inviteExpiryTime]);

  async function openAssessment(
    assessmentId: string,
    preferredSectionSlug?: string,
  ) {
    if (!activeCandidateId) return;

    writeActiveJobAssessment(assessmentId);

    const sections = readActiveAssessmentSections() as SectionPreview[];

    const sectionDurations = Object.fromEntries(
      sections.map((section) => [
        section.slug,
        Number(section.time?.match(/(\d+)/)?.[1] ?? 0) * 60,
      ]),
    );

    const questionDurations = Object.fromEntries(
      sections.flatMap((section) => {
        const sectionSeconds =
          Number(section.time?.match(/(\d+)/)?.[1] ?? 0) * 60;

        return section.questions.map((question) => [
          question.id,
          question.timeLimitSeconds ??
            section.questionTimeSeconds ??
            Math.max(1, Math.floor(sectionSeconds / section.questions.length)),
        ]);
      }),
    );

    try {
      setOpeningTarget(
        preferredSectionSlug
          ? `${assessmentId}:${preferredSectionSlug}`
          : assessmentId,
      );

      const attempt = await startOrResumeAssessmentAttempt(
        activeCandidateId,
        assessmentId,
        sectionDurations,
        questionDurations,
      );

      writeStoredAnswers(attempt.answers ?? {});

      window.localStorage.setItem(
        QUESTION_STATUS_STORAGE_KEY,
        JSON.stringify(attempt.questionStatuses ?? {}),
      );

      await enterAssessmentFullscreen();

      router.push(
        `/assessment/${
          preferredSectionSlug ??
          attempt.currentSectionSlug ??
          sections[0]?.slug ??
          "english"
        }`,
      );
    } catch (error) {
      setOpeningTarget(null);

      toast.error(
        error instanceof Error ? error.message : "Could not open assessment.",
      );
    }
  }

  function logoutCandidate() {
    window.localStorage.removeItem("kgm-hiring-authenticated");
    window.localStorage.removeItem("kgm-hiring-active-candidate-id");
    window.localStorage.removeItem("kgm-hiring-active-assessment-id");
    window.localStorage.removeItem("kgm-hiring-assessment-answers");
    window.location.assign("/");
  }

  const canLogoutAndResumeLater =
    candidateAssessmentIds.length > 1 && pendingCandidateAssessments.length > 0;

  if (!activeAssessment || !activeCandidate) {
    return (
      <section className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full border-dashed shadow-none">
          <CardHeader className="items-center text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-md bg-muted">
              <ShieldCheck className="size-7 text-muted-foreground" />
            </div>

            <CardTitle className="text-2xl">No assessment assigned</CardTitle>

            <CardDescription className="mx-auto max-w-xl text-base leading-7">
              Enter a valid candidate invitation OTP before opening the assessment.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex justify-center pb-8">
            <Button asChild size="lg">
              <Link href="/">Go to candidate portal</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const expiryLabel = formatDateTime(activeCandidate.inviteExpiresAt);
  const totalDuration =
    activeAssessment.sectionCount * activeAssessment.timePerSectionMinutes;

  return (
    <>
      {isOpeningSection ? (
        <>
          <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-r-full bg-primary" />
          </div>

          <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 rounded-md border bg-background px-4 py-3 text-sm shadow-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              Opening assessment...
            </div>
          </div>
        </>
      ) : null}

      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3 w-fit gap-2 py-1 px-2">
                <Clock3 className="size-3.5" />
                Expires {expiryLabel}
              </Badge>

              <h1 className="text-3xl font-semibold tracking-tight">
                {activeCandidate?.jobTitle ?? activeAssessment.role}
              </h1>

              <p className="mt-2  text-sm leading-6 text-muted-foreground">
                Review the instructions, check each section, and start when you
                are ready. Your saved answers resume from the existing attempt.
              </p>
            </div>

            {canLogoutAndResumeLater ? (
              <Button
                type="button"
                variant="outline"
                onClick={logoutCandidate}
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            ) : null}
          </div>

          <Card className="border-primary/20 bg-primary/5 shadow-none">
            <CardHeader className="gap-4 border-b bg-background/50 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-3">
              

                <CardTitle>Important instructions</CardTitle>
                <CardDescription className=" leading-6">
                  Stay in fullscreen and keep the test window open during the assessment. Timers continue once a question or section is active. Skipped questions can be reopened only if time is still available.

                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          {isInviteExpired ? (
            <Card className="border-destructive/25 bg-destructive/5 shadow-none">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <AlertTriangle className="size-5" />
                  </div>

                  <div>
                    <CardTitle>Invitation expired</CardTitle>
                    <CardDescription className="mt-1 leading-6">
                      This assessment invitation has expired. You can no longer
                      start, continue, or submit any assessment from this invite.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                {candidateAssessments.map((assessment) => {
                  const isSubmitted = submittedAssessmentIds.has(assessment.id);

                  const attempt = attempts.find(
                    (item) => item.assessmentId === assessment.id,
                  );

                  const status = isSubmitted
                    ? "Submitted"
                    : isInviteExpired
                      ? "Expired"
                      : attempt?.status === "In Progress"
                        ? "In Progress"
                        : "Not Started";

                  const canOpen =
                    status === "Not Started" || status === "In Progress";

                  const meta = getStatusMeta(status);
                  const StatusIcon = meta.icon;

                  return (
                    <Card
                      key={assessment.id}
                      className="overflow-hidden shadow-none transition hover:border-primary/30"
                    >
                      <CardHeader className="border-b bg-muted/20 py-[0.4rem]">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between ">
                          <div className="min-w-0">
                            <div className="flex lg:flex-row  w-fit items-start gap-2 flex-col pt-2">
                              <CardTitle className="line-clamp-2 text-lg sm:text-xl ">
                                {activeCandidate.jobTitle ?? assessment.title}
                              </CardTitle>

                              <Badge
                                variant="outline"
                                className={`${meta.badgeClass}`}
                              >
                                <StatusIcon className="mr-1 size-3.5" />
                                {meta.label}
                              </Badge>
                            </div>

                            <CardDescription className=" mt-1">
                              Check section details before starting.
                            </CardDescription>
                          </div>

                          <div className="flex flex-wrap  items-center gap-2">
                            <Button
className=' lg:my-5 mb-5'
                              disabled={!canOpen || isOpeningSection}
                              onClick={() => void openAssessment(assessment.id)}
                            >
                              {openingTarget === assessment.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <ArrowRight className="size-4" />
                              )}

                              {openingTarget === assessment.id
                                ? "Opening..."
                                : meta.buttonLabel}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4 p-4 sm:p-5">
                        <div className="space-y-3">
                          <div className="flex flex-col gap-1  sm:flex-row sm:items-end sm:justify-between">
                            <div>
                              
                               <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <CardTitle className="text-base">
                                Sections
                              </CardTitle>


                              <Badge variant="secondary" className="w-fit rounded-[6px] px-2 " > {activeSections.length || assessment.sectionCount}{" "} sections </Badge>
</div>
                              <CardDescription className="mt-1 max-w-2xl text-sm leading-6">
                                Open any available section. Progress, answers,
                                and paused skipped-question timers are saved
                                automatically.
                              </CardDescription>
                            </div>

                          
                          </div>

                          <div className="flex flex-col gap-2">
                            {activeSections.map((section, sectionIndex) => {
                              const sectionOpeningKey = `${assessment.id}:${section.slug}`;
                              const isThisSectionOpening =
                                openingTarget === sectionOpeningKey;

                              const sectionQuestionIds = section.questions.map(
                                (question) => question.id,
                              );

                              const sectionAnsweredCount = getAnsweredCount(
                                answers,
                                sectionQuestionIds,
                              );

                              const sectionNumber = String(
                                sectionIndex + 1,
                              ).padStart(2, "0");

                              return (
                                <button
                                  key={`${assessment.id}-${section.slug}`}
                                  type="button"
                                  disabled={!canOpen || isOpeningSection}
                                  onClick={() =>
                                    void openAssessment(
                                      assessment.id,
                                      section.slug,
                                    )
                                  }
                                  className="group flex w-full flex-col gap-4 rounded-xl border bg-background p-4 text-left shadow-none transition-all hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
                                >
                                  <div className="min-w-0 flex-1 space-y-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge
                                            variant="outline"
                                            className="rounded-md bg-muted/35 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                          >
                                            Section {sectionNumber}
                                          </Badge>

                                          <Badge
                                            variant="outline"
                                            className="rounded-md border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
                                          >
                                            {sectionAnsweredCount}/
                                            {section.questions.length} saved
                                          </Badge>
                                        </div>

                                        <p className="mt-2 truncate text-base font-semibold tracking-tight">
                                          {getSectionName(
                                            section,
                                            sectionIndex,
                                          )}
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                          Section progress is saved automatically.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-start">
                                      <div className="min-w-[120px]">
                                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <ListChecks className="size-3.5" />
                                          Questions
                                        </p>

                                        <p className="mt-1 text-xs mt-2">
                                          {section.questions.length}
                                        </p>
                                      </div>

                                      <div className="min-w-[160px] sm:border-l sm:pl-4">
                                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <FileText className="size-3.5" />
                                          Types
                                        </p>

                                        <p className="mt-1 max-w-[220px] truncate text-xs   mt-2">
                                          {getQuestionTypeLabel(section)}
                                        </p>
                                      </div>

                                      <div className="min-w-[120px] sm:border-l sm:pl-4">
                                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Clock3 className="size-3.5" />
                                          Total time
                                        </p>

                                        <p className="mt-1 text-xs mt-2">
                                          {getSectionTime(
                                            section,
                                            assessment.timePerSectionMinutes,
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex size-9 shrink-0 items-center justify-center self-end rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground lg:self-center">
                                    {isThisSectionOpening ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <ChevronRight className="size-4" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
                <Card className="overflow-hidden shadow-none">
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Overview</CardTitle>
                    <CardDescription>Assessment Overview</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 py-5">
                    <div className=" space-y-2 rounded-md border bg-muted/30 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Saved answers
                        </span>
                        <span className="font-semibold">
                          {completionPercent}%
                        </span>
                      </div>

                      <div className="h-1  overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {answeredQuestions} of {totalQuestions} questions saved.
                      </p>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-md border bg-muted/30 p-4">
                        <Clock3 className="mb-3 size-5 text-muted-foreground" />
                        <p className="text-sm font-medium">Total duration</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {totalDuration} min
                        </p>
                      </div>

                      <div className="rounded-md border bg-muted/30 p-4">
                        <FileText className="mb-3 size-5 text-muted-foreground" />
                        <p className="text-sm font-medium">Sections</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {activeSections.length}
                        </p>
                      </div>

                      <div className="rounded-md border bg-muted/30 p-4">
                        <ListChecks className="mb-3 size-5 text-muted-foreground" />
                        <p className="text-sm font-medium">Questions</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {totalQuestions}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </div>
      </section>

      <Dialog open={showCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <CheckCircle2 className="size-5" />
            </div>

            <DialogTitle>Test submitted</DialogTitle>

            <DialogDescription>
              {pendingCandidateAssessments.length
                ? "Your assessment was submitted successfully. You can return to the main page and open any remaining assessment assigned to this job."
                : "Your assessment was submitted successfully. All assessments assigned to this job are completed."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              onClick={() => {
                if (pendingCandidateAssessments.length) {
                  setShowCompletionDialog(false);
                  return;
                }

                window.location.assign("/");
              }}
            >
              {pendingCandidateAssessments.length
                ? "Back to assessments"
                : "Finish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
