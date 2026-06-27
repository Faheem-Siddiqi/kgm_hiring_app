"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
  Send,
  ShieldAlert,
  TriangleAlert,
  Volume2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  createViolation,
  readActiveAssessmentSections,
  readActiveJobAssessment,
  subscribeToAdminData,
  saveAssessmentResult,
} from "@/features/test/admin-storage";
import {
  enterAssessmentFullscreen,
  exitAssessmentFullscreen,
  getAssessmentFullscreenElement,
} from "@/features/test/assessment-fullscreen";
import { assessmentSections } from "@/features/test/assessment-data";
import {
  getAnsweredCount,
  getTotalQuestionCount,
  readStoredAnswersSnapshot,
  writeStoredAnswers,
} from "@/features/test/assessment-storage";

type SectionRunnerProps = {
  sectionSlug: string;
};

type QuestionStatus = "skipped" | "unanswered";

const QUESTION_STATUS_KEY = "kgm-hiring-assessment-question-statuses";

function readQuestionStatuses(): Record<string, QuestionStatus> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(QUESTION_STATUS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function getSectionDurationSeconds(time: string) {
  const match = time.match(/(\d+)/);

  return match ? Number(match[1]) * 60 : 0;
}

function formatTimeLeft(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function readStoredDeadline(key: string) {
  const storedValue =
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  const parsedValue = storedValue ? Number(storedValue) : 0;

  return Number.isFinite(parsedValue) && parsedValue > Date.now()
    ? parsedValue
    : null;
}

function writeStoredDeadline(key: string, value: number) {
  window.localStorage.setItem(key, String(value));
  window.sessionStorage.setItem(key, String(value));
}

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

export function SectionRunner({ sectionSlug }: SectionRunnerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>(() => readQuestionStatuses());
  const [showWindowWarning, setShowWindowWarning] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [isChangingSection, setIsChangingSection] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [lastViolationNumber, setLastViolationNumber] = useState<number | null>(
    null,
  );
  const [submissionStatus, setSubmissionStatus] = useState<
    "Submitted" | "Auto submitted"
  >("Submitted");
  const windowWarningQueuedRef = useRef(false);
  const isStoppingAssessmentRef = useRef(false);
  const timerEndAtRef = useRef<number | null>(null);
  const questionTimerEndAtRef = useRef<number | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const answersSnapshot = useSyncExternalStore(
    subscribeToTestData,
    readStoredAnswersSnapshot,
    () => "{}",
  );
  const answers = JSON.parse(answersSnapshot) as Record<string, string>;
  const activeAssessment = readActiveJobAssessment();
  const activeSections = readActiveAssessmentSections();
  const section =
    activeSections.find((item) => item.slug === sectionSlug) ??
    assessmentSections.find((item) => item.slug === sectionSlug) ??
    activeSections[0] ??
    assessmentSections[0];
  const sectionIndex = activeSections.findIndex((item) => item.slug === section.slug);
  const previousSectionSlug = activeSections[sectionIndex - 1]?.slug;
  const nextSectionSlug = activeSections[sectionIndex + 1]?.slug;
  const currentQuestion = section.questions[currentIndex];
  const sectionDurationSeconds = getSectionDurationSeconds(section.time);
  const timerStorageKey = `kgm-hiring-assessment-timer-${section.slug}`;
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(sectionDurationSeconds);
  const questionDurationSeconds =
    currentQuestion.timeLimitSeconds ?? section.questionTimeSeconds ??
    Math.max(1, Math.floor(sectionDurationSeconds / section.questions.length));
  const questionTimerStorageKey = `kgm-hiring-assessment-question-timer-${section.slug}-${currentQuestion.id}`;
  const questionRemainingStorageKey = `${questionTimerStorageKey}-remaining`;
  const [questionTimeLeftSeconds, setQuestionTimeLeftSeconds] =
    useState(questionDurationSeconds);
  const [speechStatus, setSpeechStatus] = useState<
    "idle" | "reading" | "unsupported"
  >("idle");
  const questionIds = section.questions.map((question) => question.id);
  const answeredCount = getAnsweredCount(answers, questionIds);
  const sectionProgress = Math.round(
    (answeredCount / section.questions.length) * 100,
  );
  const questionProgress = Math.round(
    ((currentIndex + 1) / section.questions.length) * 100,
  );
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === section.questions.length - 1;
  const isTimeUp = timeLeftSeconds <= 0;
  const isQuestionTimeUp = questionTimeLeftSeconds <= 0;
  const isLastMinute = timeLeftSeconds > 0 && timeLeftSeconds <= 60;
  const isAnswerLocked = isTimeUp || isQuestionTimeUp;
  const hasCurrentAnswer = Boolean(answers[currentQuestion.id]?.trim());
  const timerProgress = sectionDurationSeconds
    ? Math.round((timeLeftSeconds / sectionDurationSeconds) * 100)
    : 0;
  const questionTimerProgress = questionDurationSeconds
    ? Math.round((questionTimeLeftSeconds / questionDurationSeconds) * 100)
    : 0;
  const totalQuestionCount = getTotalQuestionCount();
  const activeQuestionIds = activeSections.flatMap((assessmentSection) =>
    assessmentSection.questions.map((question) => question.id),
  );
  const totalAnsweredCount = getAnsweredCount(answers, activeQuestionIds);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  function submitAssessment(status: "Submitted" | "Auto submitted") {
    saveAssessmentResult({
      answers: answersRef.current,
      status,
    });
    setSubmissionStatus(status);
    setShowCompletionDialog(true);
  }

  useEffect(() => {
    void enterAssessmentFullscreen().then((enteredFullscreen) => {
      if (!enteredFullscreen) {
        setShowWindowWarning(true);
        windowWarningQueuedRef.current = true;
      }
    });
  }, []);

  useEffect(() => {
    function showWarning(reason = "Window or fullscreen switch detected") {
      if (isStoppingAssessmentRef.current) {
        return;
      }

      if (windowWarningQueuedRef.current) {
        return;
      }

      const violations = createViolation(section.slug, reason);
      const nextViolationCount = violations.length;

      setViolationCount(nextViolationCount);
      setLastViolationNumber(nextViolationCount);

      if (nextViolationCount >= 3) {
        isStoppingAssessmentRef.current = true;
        setShowWindowWarning(false);
        void exitAssessmentFullscreen();
        submitAssessment("Auto submitted");
        return;
      }

      windowWarningQueuedRef.current = true;
      flushSync(() => {
        setShowWindowWarning(true);
      });
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      showWarning("Tried to leave or reload assessment");
      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentMouseOut(event: MouseEvent) {
      if (!event.relatedTarget) {
        showWarning("Mouse left the assessment window");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isBrowserOrWindowShortcut =
        event.altKey ||
        event.metaKey ||
        (event.ctrlKey &&
          ["l", "n", "r", "t", "w", "tab"].includes(event.key.toLowerCase()));

      if (!isBrowserOrWindowShortcut) {
        return;
      }

      showWarning("Browser or operating system shortcut attempted");
      event.preventDefault();
      event.stopPropagation();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        showWarning("Assessment tab became hidden");
      }
    }

    function handleFullscreenChange() {
      if (!getAssessmentFullscreenElement()) {
        showWarning("Exited fullscreen mode");
      }
    }

    function handleWindowBlur() {
      showWarning("Assessment window lost focus");
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mouseout", handleDocumentMouseOut);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mouseout", handleDocumentMouseOut);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [section.slug]);

  useEffect(() => {
    const storedEndAt = readStoredDeadline(timerStorageKey);
    const endAt = storedEndAt ?? Date.now() + sectionDurationSeconds * 1000;
    timerEndAtRef.current = endAt;

    if (!storedEndAt) {
      writeStoredDeadline(timerStorageKey, endAt);
    }

    function updateTimer() {
      const timerEndAt = timerEndAtRef.current ?? endAt;
      const nextTimeLeft = Math.max(
        0,
        Math.ceil((timerEndAt - Date.now()) / 1000),
      );
      setTimeLeftSeconds(nextTimeLeft);
    }

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(intervalId);
  }, [sectionDurationSeconds, timerStorageKey]);

  useEffect(() => {
    const storedEndAt = readStoredDeadline(questionTimerStorageKey);
    const storedRemaining =
      window.localStorage.getItem(questionRemainingStorageKey) ??
      window.sessionStorage.getItem(questionRemainingStorageKey);
    const remainingSeconds = storedRemaining
      ? Math.max(0, Number(storedRemaining))
      : questionDurationSeconds;
    const endAt = storedEndAt ?? Date.now() + remainingSeconds * 1000;
    questionTimerEndAtRef.current = endAt;

    if (!storedEndAt) {
      writeStoredDeadline(questionTimerStorageKey, endAt);
      window.sessionStorage.removeItem(questionRemainingStorageKey);
      window.localStorage.removeItem(questionRemainingStorageKey);
    }

    function updateQuestionTimer() {
      const timerEndAt = questionTimerEndAtRef.current ?? endAt;
      const nextTimeLeft = Math.max(
        0,
        Math.ceil((timerEndAt - Date.now()) / 1000),
      );
      setQuestionTimeLeftSeconds(nextTimeLeft);
    }

    updateQuestionTimer();
    const intervalId = window.setInterval(updateQuestionTimer, 1000);

    return () => window.clearInterval(intervalId);
  }, [questionDurationSeconds, questionRemainingStorageKey, questionTimerStorageKey]);

  function writeQuestionStatus(questionId: string, status: QuestionStatus) {
    const next = { ...questionStatuses, [questionId]: status };
    window.localStorage.setItem(QUESTION_STATUS_KEY, JSON.stringify(next));
    setQuestionStatuses(next);
  }

  function pauseCurrentQuestionTimer() {
    const remaining = questionTimeLeftSeconds;
    window.sessionStorage.setItem(questionRemainingStorageKey, String(remaining));
    window.localStorage.setItem(questionRemainingStorageKey, String(remaining));
    window.sessionStorage.removeItem(questionTimerStorageKey);
    window.localStorage.removeItem(questionTimerStorageKey);
    questionTimerEndAtRef.current = null;
  }

  function moveToQuestion(index: number) {
    if (isTimeUp || index === currentIndex) return;
    pauseCurrentQuestionTimer();
    setCurrentIndex(index);
  }

  function skipCurrentQuestion() {
    writeQuestionStatus(currentQuestion.id, "skipped");
    pauseCurrentQuestionTimer();
    if (!isLastQuestion) {
      setCurrentIndex((index) => index + 1);
    }
  }

  useEffect(() => {
    if (!isQuestionTimeUp || isTimeUp) return;

    const timeoutId = window.setTimeout(() => {
      setQuestionStatuses((current) => {
        const next: Record<string, QuestionStatus> = {
          ...current,
          [currentQuestion.id]: "unanswered",
        };
        window.localStorage.setItem(QUESTION_STATUS_KEY, JSON.stringify(next));
        return next;
      });
      window.sessionStorage.setItem(questionRemainingStorageKey, "0");
      window.localStorage.setItem(questionRemainingStorageKey, "0");
      window.sessionStorage.removeItem(questionTimerStorageKey);
      window.localStorage.removeItem(questionTimerStorageKey);
      if (!isLastQuestion) {
        setCurrentIndex((index) => index + 1);
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [currentQuestion.id, isLastQuestion, isQuestionTimeUp, isTimeUp, questionRemainingStorageKey, questionTimerStorageKey]);

  useEffect(() => {
    router.prefetch("/test");

    if (previousSectionSlug) {
      router.prefetch(`/test/${previousSectionSlug}`);
    }

    if (nextSectionSlug) {
      router.prefetch(`/test/${nextSectionSlug}`);
    }
  }, [nextSectionSlug, previousSectionSlug, router]);

  function updateAnswer(questionId: string, value: string) {
    if (isAnswerLocked) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [questionId]: value,
    };

    writeStoredAnswers(nextAnswers);
  }

  function toggleMultiAnswer(questionId: string, option: string) {
    if (isAnswerLocked) {
      return;
    }

    const existingValues = answers[questionId]
      ? answers[questionId].split("||").filter(Boolean)
      : [];
    const isSelected = existingValues.includes(option);
    const nextValues = isSelected
      ? existingValues.filter((value) => value !== option)
      : [...existingValues, option];

    writeStoredAnswers({
      ...answers,
      [questionId]: nextValues.join("||"),
    });
  }

  function preventContentCopy(event: React.ClipboardEvent | React.MouseEvent) {
    const target = event.target as HTMLElement;

    if (target.closest("textarea")) {
      return;
    }

    event.preventDefault();
  }

  async function stopAssessment() {
    isStoppingAssessmentRef.current = true;
    setShowWindowWarning(false);
    await exitAssessmentFullscreen();
    router.replace("/test");
  }

  function leaveTimedOutSection() {
    router.replace("/test");
  }

  function resetSectionTimer() {
    const nextEndAt = Date.now() + sectionDurationSeconds * 1000;

    timerEndAtRef.current = nextEndAt;
    writeStoredDeadline(timerStorageKey, nextEndAt);
    setTimeLeftSeconds(sectionDurationSeconds);
  }

  function readQuestionAloud() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setSpeechStatus("unsupported");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.prompt);
    utterance.onend = () => setSpeechStatus("idle");
    utterance.onerror = () => setSpeechStatus("idle");
    setSpeechStatus("reading");
    window.speechSynthesis.speak(utterance);
  }

  async function continueAssessment() {
    const enteredFullscreen = await enterAssessmentFullscreen();

    if (!enteredFullscreen) {
      windowWarningQueuedRef.current = true;
      setShowWindowWarning(true);
      return;
    }

    windowWarningQueuedRef.current = false;
    setShowWindowWarning(false);
  }

  return (
    <>
      {isChangingSection ? (
        <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-r-full bg-primary" />
        </div>
      ) : null}
      <main
        className="min-h-svh select-none bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8"
        onContextMenu={preventContentCopy}
        onCopy={preventContentCopy}
        onCut={preventContentCopy}
      >
        <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.8fr_1.4fr]">
          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="w-fit gap-2">
                    <Clock3 className="size-3.5" />
                    {section.time}
                  </Badge>
                  <Badge variant="outline" className="w-fit gap-2 font-mono">
                    <Clock3 className="size-3.5" />
                    Question {formatTimeLeft(questionTimeLeftSeconds)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={[
                      "w-fit gap-2 font-mono",
                      isTimeUp || isLastMinute
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "",
                    ].join(" ")}
                  >
                    <Clock3 className="size-3.5" />
                    {formatTimeLeft(timeLeftSeconds)}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{section.title}</CardTitle>
                <CardDescription>
                  Question {currentIndex + 1} of {section.questions.length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Time remaining</span>
                    <span
                      className={
                        isTimeUp || isLastMinute
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {formatTimeLeft(timeLeftSeconds)}
                    </span>
                  </div>
                  <Progress value={timerProgress} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Section answered</span>
                    <span className="text-muted-foreground">
                      {answeredCount}/{section.questions.length}
                    </span>
                  </div>
                  <Progress value={sectionProgress} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Question position</span>
                    <span className="text-muted-foreground">
                      {questionProgress}%
                    </span>
                  </div>
                  <Progress value={questionProgress} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Question time</span>
                    <span
                      className={
                        isQuestionTimeUp
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {formatTimeLeft(questionTimeLeftSeconds)}
                    </span>
                  </div>
                  <Progress value={questionTimerProgress} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Navigation</CardTitle>
                <CardDescription>Move through one question at a time.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {section.questions.map((question, index) => {
                  const isAnswered = Boolean(answers[question.id]?.trim());
                  const status = questionStatuses[question.id];
                  const canLeaveCurrentQuestion =
                    hasCurrentAnswer || Boolean(questionStatuses[currentQuestion.id]);

                  return (
                    <Button
                      className={[
                        "justify-between border",
                        index === currentIndex
                          ? "border-primary/50 bg-primary/10 text-foreground shadow-none hover:bg-primary/15"
                          : "bg-background hover:bg-muted/60",
                      ].join(" ")}
                      key={question.id}
                      onClick={() => {
                        moveToQuestion(index);
                      }}
                      disabled={isTimeUp || (!canLeaveCurrentQuestion && index !== currentIndex)}
                      variant="outline"
                    >
                      <span>Question {index + 1}</span>
                      <span
                        aria-label={isAnswered ? "Answered" : status === "skipped" ? "Skipped" : status === "unanswered" ? "Timed out" : "Pending"}
                        className={[
                          "inline-flex size-6 items-center justify-center rounded-full border",
                          isAnswered
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-600",
                        ].join(" ")}
                        title={isAnswered ? "Answered" : status === "skipped" ? "Skipped" : status === "unanswered" ? "Timed out" : "Pending"}
                      >
                        {isAnswered ? (
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                        ) : (
                          <TriangleAlert className="size-4" aria-hidden="true" />
                        )}
                      </span>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button asChild variant="outline">
                <Link href="/test">
                  <ArrowLeft className="size-4" />
                  All sections
                </Link>
              </Button>
              <Badge variant="outline">
                {activeAssessment?.role ?? "Assessment"}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardDescription>
                  {section.title} - Question {currentIndex + 1}
                </CardDescription>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-2xl leading-8">
                    {currentQuestion.prompt}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2"
                    onClick={readQuestionAloud}
                    title="Read question aloud"
                  >
                    {speechStatus === "reading" ? (
                      <Headphones className="size-4" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                    {speechStatus === "reading" ? "Reading" : "Read"}
                  </Button>
                </div>
                {speechStatus === "unsupported" ? (
                  <p className="text-sm text-muted-foreground">
                    Text-to-speech is not supported by this browser.
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-6">
                {currentQuestion.type === "text" ? (
                  <Textarea
                    className="select-text"
                    disabled={isAnswerLocked}
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id] ?? ""}
                    onChange={(event) =>
                      updateAnswer(currentQuestion.id, event.target.value)
                    }
                  />
                ) : currentQuestion.type === "mcq" ? (
                  <div className="grid gap-3">
                    {currentQuestion.options.map((option) => {
                      const isSelected = answers[currentQuestion.id] === option;

                      return (
                        <button
                          className={[
                            "rounded-md border p-4 text-left text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted/60",
                          ].join(" ")}
                          key={option}
                          disabled={isAnswerLocked}
                          onClick={() => updateAnswer(currentQuestion.id, option)}
                          type="button"
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <p className="text-sm text-muted-foreground">
                      You may select multiple options.
                    </p>
                    {currentQuestion.options.map((option) => {
                      const selectedValues = (answers[currentQuestion.id] ?? "")
                        .split("||")
                        .filter(Boolean);
                      const isSelected = selectedValues.includes(option);
                      const isMaxed =
                        !isSelected &&
                        selectedValues.length >= currentQuestion.maxSelections;

                      return (
                        <button
                          className={[
                            "rounded-md border p-4 text-left text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted/60",
                          ].join(" ")}
                          key={option}
                          disabled={isAnswerLocked || isMaxed}
                          onClick={() =>
                            toggleMultiAnswer(currentQuestion.id, option)
                          }
                          type="button"
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isQuestionTimeUp && !isTimeUp ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    Time for this question has ended. You can move to another
                    question, but this answer is locked.
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    disabled={isFirstQuestion || (!hasCurrentAnswer && !questionStatuses[currentQuestion.id])}
                    onClick={() => {
                      moveToQuestion(currentIndex - 1);
                    }}
                    variant="outline"
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>

                  <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isTimeUp || isQuestionTimeUp}
                    onClick={skipCurrentQuestion}
                  >
                    Skip for now
                  </Button>
                  {isLastQuestion ? (
                    nextSectionSlug ? (
                      hasCurrentAnswer ? (
                        <Button asChild>
                          <Link
                            href={`/test/${nextSectionSlug}`}
                            onClick={() => {
                              pauseCurrentQuestionTimer();
                              setIsChangingSection(true);
                            }}
                          >
                            Next section
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button disabled>
                          Next section
                          <ArrowRight className="size-4" />
                        </Button>
                      )
                    ) : (
                      <Button disabled={!hasCurrentAnswer} onClick={() => submitAssessment("Submitted")}>
                        Submit Test
                        <Send className="size-4" />
                      </Button>
                    )
                  ) : (
                    <Button
                      disabled={isTimeUp || !hasCurrentAnswer}
                      onClick={() => moveToQuestion(currentIndex + 1)}
                    >
                      Next
                      <ArrowRight className="size-4" />
                    </Button>
                  )}
                  </div>
                </div>

                {previousSectionSlug ? (
                  <Button asChild variant="ghost">
                    <Link
                      href={`/test/${previousSectionSlug}`}
                      onClick={() => setIsChangingSection(true)}
                    >
                      <ArrowLeft className="size-4" />
                      Previous section
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Dialog open={showWindowWarning}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-destructive text-white">
              <ShieldAlert className="size-5" />
            </div>
            <DialogTitle>Fullscreen required</DialogTitle>
            <DialogDescription>
              Violation{" "}
              <span className="font-mono text-destructive">
                :{String(lastViolationNumber ?? violationCount).padStart(2, "0")}
              </span>{" "}
              recorded. The assessment must stay in fullscreen. On the 3rd
              violation, the assessment is submitted automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={stopAssessment}>
              Stop assessment
            </Button>
            <Button onClick={continueAssessment}>
              Continue assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTimeUp}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-destructive text-white">
              <Clock3 className="size-5" />
            </div>
            <DialogTitle>Time is up</DialogTitle>
            <DialogDescription>
              The allotted time for this section has ended. You can return to
              the assessment overview.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={resetSectionTimer}>
              Reset timer
            </Button>
            <Button onClick={leaveTimedOutSection}>Back to overview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <CheckCircle2 className="size-5" />
            </div>
            <DialogTitle>Test submitted</DialogTitle>
            <DialogDescription>
              {submissionStatus === "Auto submitted"
                ? "The assessment was submitted automatically after 3 fullscreen violations."
                : "Your assessment preview is complete. Saved answers remain on this device until the backend submission endpoint is connected."}
            </DialogDescription>
          </DialogHeader>
          {submissionStatus === "Auto submitted" ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Assessment terminated after violation :03.
            </div>
          ) : null}
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <span className="font-medium">{totalAnsweredCount}</span> of{" "}
            <span className="font-medium">{totalQuestionCount}</span> questions
            have saved answers.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompletionDialog(false)}>
              Review answers
            </Button>
            <Button onClick={() => router.replace("/test")}>
              Back to overview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
