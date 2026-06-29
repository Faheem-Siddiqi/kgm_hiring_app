"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  Send,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { enterAssessmentFullscreen } from "@/features/test/assessment-fullscreen";
import {
  readActiveAssessmentSections,
  readActiveJobAssessment,
  saveAssessmentResult,
  subscribeToAdminData,
} from "@/features/test/admin-storage";
import {
  getAnsweredCount,
  getTotalQuestionCount,
  readStoredAnswersSnapshot,
} from "@/features/test/assessment-storage";

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

export function TestOverview() {
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [isOpeningSection, setIsOpeningSection] = useState(false);
  const answersSnapshot = useSyncExternalStore(
    subscribeToTestData,
    readStoredAnswersSnapshot,
    () => "{}",
  );
  const answers = JSON.parse(answersSnapshot) as Record<string, string>;
  const activeAssessment = readActiveJobAssessment();
  const assessmentSections = readActiveAssessmentSections();
  const totalQuestions = getTotalQuestionCount();
  const answeredQuestions = getAnsweredCount(
    answers,
    assessmentSections.flatMap((section) =>
      section.questions.map((question) => question.id),
    ),
  );
  const overallProgress = Math.round((answeredQuestions / totalQuestions) * 100);

  async function submitAssessment() {
    try {
      await saveAssessmentResult({
        answers,
        status: "Submitted",
      });
      setShowCompletionDialog(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission could not be saved.");
    }
  }

  if (!activeAssessment) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>No assessment assigned</CardTitle>
            <CardDescription>
              Enter a valid candidate invitation OTP before opening the assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Go to candidate portal</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <>
      {isOpeningSection ? (
        <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-r-full bg-primary" />
        </div>
      ) : null}
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.35fr_0.75fr]">
      <div className="space-y-6">
        <div className="space-y-4">
          <Badge variant="secondary" className="gap-2">
            <CheckCircle2 className="size-3.5" />
            Identity verified
          </Badge>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {activeAssessment.role}
            </h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              Complete each section in order. Your responses are saved as you
              work and your progress updates automatically.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-xl">Assessment Sections</CardTitle>
                <CardDescription>
                  Open a section, answer each question, then continue to the next section.
                </CardDescription>
              </div>
              <Badge variant="outline">{overallProgress}% complete</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {assessmentSections.map((section, sectionIndex) => {
              const sectionQuestionIds = section.questions.map(
                (question) => question.id,
              );
              const answeredCount = getAnsweredCount(answers, sectionQuestionIds);
              const progress = Math.round(
                (answeredCount / section.questions.length) * 100,
              );

              return (
                <Link
                  className="block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={`/test/${section.slug}`}
                  key={section.slug}
                  onClick={() => {
                    setIsOpeningSection(true);
                    void enterAssessmentFullscreen();
                  }}
                >
                  <Card className="shadow-none hover:border-ring/60 hover:bg-muted/20">
                    <CardHeader className="p-4 pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">
                            {sectionIndex + 1}. {section.title}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Clock3 className="size-4" />
                            Time allowed: {section.time}
                          </CardDescription>
                        </div>
                        <Badge variant={progress === 100 ? "default" : "secondary"}>
                          {answeredCount}/{section.questions.length} answered
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 pt-0">
                      <Progress value={progress} />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Continue this section
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}

            <Separator />

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Ready to submit?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review your responses before submitting the completed assessment.
                </p>
              </div>
              <Button
                className="w-full sm:w-auto"
                disabled={answeredQuestions < totalQuestions}
                onClick={() => void submitAssessment()}
              >
                Submit Test
                <Send className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Overview</CardTitle>
          <CardDescription>{activeAssessment.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="rounded-md border bg-muted/30 p-4">
                <Clock3 className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">Total duration</p>
                <p className="mt-1 text-2xl font-semibold">
                  {activeAssessment.sectionCount *
                    activeAssessment.timePerSectionMinutes}{" "}
                  min
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <FileText className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">Sections</p>
                <p className="mt-1 text-2xl font-semibold">
                  {assessmentSections.length}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <ListChecks className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">Questions</p>
                <p className="mt-1 text-2xl font-semibold">{totalQuestions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>
      </section>

      <Dialog open={showCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <CheckCircle2 className="size-5" />
            </div>
            <DialogTitle>Test submitted</DialogTitle>
            <DialogDescription>
              Thanks for submitting your assessment. Your access code has now
              been closed.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <span className="font-medium">{answeredQuestions}</span> of{" "}
            <span className="font-medium">{totalQuestions}</span> questions have
            saved answers.
          </div>
          <DialogFooter>
            <Button onClick={() => window.location.assign("/")}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
