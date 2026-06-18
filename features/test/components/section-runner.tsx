"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Send,
  ShieldAlert,
  TriangleAlert,
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
import type { AssessmentSection } from "@/features/test/assessment-data";
import {
  getAnsweredCount,
  readStoredAnswersSnapshot,
  writeStoredAnswers,
} from "@/features/test/assessment-storage";

type SectionRunnerProps = {
  section: AssessmentSection;
  previousSectionSlug?: string;
  nextSectionSlug?: string;
};

function getSectionDurationSeconds(time: string) {
  const match = time.match(/(\d+)/);

  return match ? Number(match[1]) * 60 : 0;
}

function formatTimeLeft(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

export function SectionRunner({
  section,
  previousSectionSlug,
  nextSectionSlug,
}: SectionRunnerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWindowWarning, setShowWindowWarning] = useState(false);
  const windowWarningQueuedRef = useRef(false);
  const sectionDurationSeconds = getSectionDurationSeconds(section.time);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(sectionDurationSeconds);
  const answersSnapshot = useSyncExternalStore(
    subscribeToAnswers,
    readStoredAnswersSnapshot,
    () => "{}",
  );
  const answers = JSON.parse(answersSnapshot) as Record<string, string>;
  const currentQuestion = section.questions[currentIndex];
  const questionIds = useMemo(
    () => section.questions.map((question) => question.id),
    [section.questions],
  );
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
  const timerProgress = sectionDurationSeconds
    ? Math.round((timeLeftSeconds / sectionDurationSeconds) * 100)
    : 0;

  useEffect(() => {
    function showWarning() {
      if (windowWarningQueuedRef.current) {
        return;
      }

      windowWarningQueuedRef.current = true;
      setShowWindowWarning(true);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        showWarning();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("blur", showWarning);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("blur", showWarning);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const timerStorageKey = `kgm-hiring-assessment-timer-${section.slug}`;
    const storedEndAt = window.sessionStorage.getItem(timerStorageKey);
    const endAt = storedEndAt
      ? Number(storedEndAt)
      : Date.now() + sectionDurationSeconds * 1000;

    if (!storedEndAt) {
      window.sessionStorage.setItem(timerStorageKey, String(endAt));
    }

    function updateTimer() {
      const nextTimeLeft = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeftSeconds(nextTimeLeft);
    }

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(intervalId);
  }, [section.slug, sectionDurationSeconds]);

  function updateAnswer(questionId: string, value: string) {
    if (isTimeUp) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [questionId]: value,
    };

    writeStoredAnswers(nextAnswers);
  }

  function preventContentCopy(event: React.ClipboardEvent | React.MouseEvent) {
    const target = event.target as HTMLElement;

    if (target.closest("textarea")) {
      return;
    }

    event.preventDefault();
  }

  function stopAssessment() {
    setShowWindowWarning(false);
    router.replace("/test");
  }

  function leaveTimedOutSection() {
    router.replace("/test");
  }

  function continueAssessment() {
    windowWarningQueuedRef.current = false;
    setShowWindowWarning(false);
  }

  return (
    <>
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
                  <Badge
                    variant="outline"
                    className={[
                      "w-fit gap-2 font-mono",
                      isTimeUp
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
                        isTimeUp
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
                        if (!isTimeUp) {
                          setCurrentIndex(index);
                        }
                      }}
                      variant="outline"
                    >
                      <span>Question {index + 1}</span>
                      <span
                        aria-label={isAnswered ? "Answered" : "Pending"}
                        className={[
                          "inline-flex size-6 items-center justify-center rounded-full border",
                          isAnswered
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-600",
                        ].join(" ")}
                        title={isAnswered ? "Answered" : "Pending"}
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
              <Badge variant="outline">Assistant Admin Officer</Badge>
            </div>

            <Card>
              <CardHeader>
                <CardDescription>
                  {section.title} - Question {currentIndex + 1}
                </CardDescription>
                <CardTitle className="text-2xl leading-8">
                  {currentQuestion.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentQuestion.type === "text" ? (
                  <Textarea
                    className="select-text"
                    disabled={isTimeUp}
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id] ?? ""}
                    onChange={(event) =>
                      updateAnswer(currentQuestion.id, event.target.value)
                    }
                  />
                ) : (
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
                          disabled={isTimeUp}
                          onClick={() => updateAnswer(currentQuestion.id, option)}
                          type="button"
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    disabled={isFirstQuestion}
                    onClick={() => {
                      if (!isTimeUp) {
                        setCurrentIndex((index) => index - 1);
                      }
                    }}
                    variant="outline"
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>

                  {isLastQuestion ? (
                    nextSectionSlug ? (
                      <Button asChild>
                        <Link href={`/test/${nextSectionSlug}`}>
                          Next section
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button>
                        Submit Test
                        <Send className="size-4" />
                      </Button>
                    )
                  ) : (
                    <Button
                      disabled={isTimeUp}
                      onClick={() => setCurrentIndex((index) => index + 1)}
                    >
                      Next
                      <ArrowRight className="size-4" />
                    </Button>
                  )}
                </div>

                {previousSectionSlug ? (
                  <Button asChild variant="ghost">
                    <Link href={`/test/${previousSectionSlug}`}>
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
            <DialogTitle>Stay on the assessment screen</DialogTitle>
            <DialogDescription>
              Leaving this window during a live assessment may automatically
              submit your test. Please continue only if you understand this risk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={stopAssessment}>
              Stop assessment
            </Button>
            <Button onClick={continueAssessment}>
              I understand, continue test
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
            <Button onClick={leaveTimedOutSection}>Back to overview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
