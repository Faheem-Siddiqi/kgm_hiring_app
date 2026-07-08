"use client";
import {
  useEffect,
  useCallback,
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
  CircleDot,
  Headphones,
  Lock,
  Send,
  ShieldAlert,
  SkipForward,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { CandidateThemeCorner } from "@/components/theme/candidate-theme-corner";
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
  QUESTION_STATUS_STORAGE_KEY,
  readActiveAssessmentSections,
  readActiveJobAssessment,
  readAssessmentViolations,
  readCandidateAttempts,
  readAssessmentResults,
  readCandidates,
  saveAssessmentAttemptProgress,
  subscribeToAdminData,
  saveAssessmentResult,
} from "@/features/test/admin-storage";
import {
  enterAssessmentFullscreen,
  exitAssessmentFullscreen,
  getAssessmentFullscreenElement,
} from "@/features/test/assessment-fullscreen";
import {
  getAnsweredCount,
  getTotalQuestionCount,
  readStoredAnswersSnapshot,
  writeStoredAnswers,
} from "@/features/test/assessment-storage";
import type { AssessmentSection } from "@/features/test/assessment-types";

type SectionRunnerProps = {
  sectionSlug: string;
};

type QuestionStatus = "answered" | "skipped" | "unanswered";

const CURRENT_SECTION_STORAGE_KEY = "kgm-hiring-assessment-current-section";
const CURRENT_QUESTION_STORAGE_KEY = "kgm-hiring-assessment-current-question";

function readQuestionStatuses(): Record<string, QuestionStatus> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(QUESTION_STATUS_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function getSectionDurationSeconds(time: string) {
  const match = time.match(/(\d+)/);

  return match ? Number(match[1]) * 60 : 0;
}

function getQuestionDurationInSection(
  assessmentSection: AssessmentSection,
  question: AssessmentSection["questions"][number],
) {
  const sectionSeconds = getSectionDurationSeconds(assessmentSection.time);

  return question.timeLimitSeconds ?? assessmentSection.questionTimeSeconds ??
    Math.max(1, Math.floor(sectionSeconds / Math.max(1, assessmentSection.questions.length)));
}

function getQuestionTimerStorageKey(sectionSlug: string, questionId: string) {
  return `kgm-hiring-assessment-question-timer-${sectionSlug}-${questionId}`;
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

function clearStoredDeadline(key: string) {
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}

function readStoredNumber(key: string) {
  if (typeof window === "undefined") return null;

  const storedValue =
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  const parsedValue = storedValue ? Number(storedValue) : Number.NaN;

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function finiteNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStoredQuestionTimeLeft(key: string, fallbackSeconds: number) {
  const deadline = readStoredNumber(key);
  if (deadline !== null) {
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  }

  const remaining = readStoredNumber(`${key}-remaining`);
  if (remaining !== null) return Math.max(0, Math.ceil(remaining));

  return fallbackSeconds;
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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [isChangingSection, setIsChangingSection] = useState(false);
  const [progressRetryNonce, setProgressRetryNonce] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [lastViolationNumber, setLastViolationNumber] = useState<number | null>(
    null,
  );
  const [submissionStatus, setSubmissionStatus] = useState<
    "Submitted" | "Auto submitted"
  >("Submitted");
  const windowWarningQueuedRef = useRef(false);
  const isStoppingAssessmentRef = useRef(false);
  const isSubmittingAssessmentRef = useRef(false);
  const hasSubmissionCompletedRef = useRef(false);
  const hasAutoSubmittedRef = useRef(false);
  const restoredAttemptKeyRef = useRef<string | null>(null);
  const restoredAttemptLocationRef = useRef<string | null>(null);
  const timerEndAtRef = useRef<number | null>(null);
  const questionTimerEndAtRef = useRef<number | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const questionStatusesRef = useRef<Record<string, QuestionStatus>>(questionStatuses);
  const submitAssessmentRef = useRef<((status: "Submitted" | "Auto submitted") => Promise<void>) | null>(null);
  const answersSnapshot = useSyncExternalStore(
    subscribeToTestData,
    readStoredAnswersSnapshot,
    () => "{}",
  );
  const unavailableSection = useMemo<AssessmentSection>(
    () => ({
      slug: sectionSlug,
      title: "Assessment unavailable",
      time: "0 min",
      questions: [],
    }),
    [sectionSlug],
  );
  const answers = JSON.parse(answersSnapshot) as Record<string, string>;
  const activeAssessment = readActiveJobAssessment();
  const activeCandidateId =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("kgm-hiring-active-candidate-id");
  const activeCandidate = readCandidates().find((candidate) => candidate.id === activeCandidateId);
  const activeAttempt = readCandidateAttempts().find(
    (attempt) =>
      attempt.candidateId === activeCandidateId &&
      attempt.assessmentId === activeAssessment?.id,
  );
  const activeAssessmentSubmitted = Boolean(
    activeAssessment &&
      readAssessmentResults().some(
        (result) =>
          result.candidateId === activeCandidateId &&
          result.assessmentId === activeAssessment.id,
      ),
  );
  const activeSections = readActiveAssessmentSections();
  const section =
    activeSections.find((item) => item.slug === sectionSlug) ??
    activeSections[0] ??
    unavailableSection;
  const sectionIndex = activeSections.findIndex((item) => item.slug === section.slug);
  const activeSectionSlugKey = activeSections.map((item) => item.slug).join("|");
  const hasQuestions = section.questions.length > 0;
  const safeCurrentIndex = hasQuestions
    ? Math.min(
        Math.max(0, currentIndex),
        Math.max(0, section.questions.length - 1),
      )
    : 0;
  const currentQuestion = section.questions[safeCurrentIndex];
  const currentQuestionId = currentQuestion?.id ?? "";
  const sectionDurationSeconds = getSectionDurationSeconds(section.time);
  const timerStorageKey = `kgm-hiring-assessment-timer-${section.slug}`;
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(sectionDurationSeconds);
  const questionDurationSeconds =
    currentQuestion?.timeLimitSeconds ?? section.questionTimeSeconds ??
    Math.max(1, Math.floor(sectionDurationSeconds / Math.max(1, section.questions.length)));
  const questionTimerStorageKey = currentQuestionId
    ? getQuestionTimerStorageKey(section.slug, currentQuestionId)
    : `kgm-hiring-assessment-question-timer-${section.slug}-missing-question`;
  const questionRemainingStorageKey = `${questionTimerStorageKey}-remaining`;
  const [questionTimeLeftSeconds, setQuestionTimeLeftSeconds] =
    useState(questionDurationSeconds);
  const [speechStatus, setSpeechStatus] = useState<
    "idle" | "reading" | "unsupported"
  >("idle");
  const questionIds = section.questions.map((question) => question.id);
  const answeredCount = getAnsweredCount(answers, questionIds);
  const sectionProgress = section.questions.length
    ? Math.round((answeredCount / section.questions.length) * 100)
    : 0;
  const questionProgress = section.questions.length
    ? Math.round(((safeCurrentIndex + 1) / section.questions.length) * 100)
    : 0;
  const isFirstQuestion = safeCurrentIndex === 0;
  const isTimeUp = timeLeftSeconds <= 0;
  const isQuestionTimeUp = questionTimeLeftSeconds <= 0;
  const isLastMinute = timeLeftSeconds > 0 && timeLeftSeconds <= 60;
  const hasCurrentAnswer = Boolean(currentQuestionId && answers[currentQuestionId]?.trim());
  const isCurrentQuestionSubmitted = currentQuestionId
    ? questionStatuses[currentQuestionId] === "answered"
    : false;
  const isAnswerLocked =
    isTimeUp || isQuestionTimeUp || isCurrentQuestionSubmitted;
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
  const inviteExpiryTime = activeCandidate?.inviteExpiresAt
    ? new Date(activeCandidate.inviteExpiresAt).getTime()
    : Number.POSITIVE_INFINITY;
  const [isInviteExpired, setIsInviteExpired] = useState(false);
  const activeAttemptRestoreKey = activeAttempt
    ? [
        activeAttempt.id,
        section.slug,
        activeAttempt.currentQuestionId ?? "",
        JSON.stringify(activeAttempt.answers ?? {}),
        JSON.stringify(activeAttempt.questionStatuses ?? {}),
        JSON.stringify(activeAttempt.questionRemainingSeconds ?? {}),
        JSON.stringify(activeAttempt.questionDeadlines ?? {}),
      ].join("|")
    : "";

  const collectQuestionRemainingSeconds = useCallback(() => {
    const remainingSeconds: Record<string, number> = {};

    activeSections.forEach((assessmentSection) => {
      assessmentSection.questions.forEach((question) => {
        if (questionStatuses[question.id] !== "skipped") return;

        const key = `kgm-hiring-assessment-question-timer-${assessmentSection.slug}-${question.id}`;
        const storedRemaining = readStoredNumber(`${key}-remaining`);
        const serverRemaining = activeAttempt?.questionRemainingSeconds?.[question.id];
        const remaining =
          storedRemaining ?? finiteNumberOrNull(serverRemaining);

        if (remaining !== null && remaining > 0) {
          remainingSeconds[question.id] = Math.ceil(remaining);
        }
      });
    });

    return remainingSeconds;
  }, [activeAttempt?.questionRemainingSeconds, activeSections, questionStatuses]);

  const collectQuestionDeadlineUpdates = useCallback(() => {
    if (!currentQuestionId) return {};
    const status = questionStatuses[currentQuestionId];

    if (status === "answered" || status === "skipped" || status === "unanswered") {
      return {};
    }

    const deadline = readStoredNumber(questionTimerStorageKey);

    if (deadline === null || deadline <= Date.now()) {
      return {};
    }

    return { [currentQuestionId]: new Date(deadline).toISOString() };
  }, [currentQuestionId, questionStatuses, questionTimerStorageKey]);

  const activateSkippedQuestion = useCallback(
    (
      index: number,
      statusSource: Record<string, QuestionStatus> = questionStatusesRef.current,
      remainingSource: Record<string, number> | undefined = activeAttempt?.questionRemainingSeconds,
    ) => {
      const targetQuestion = section.questions[index];
      if (!targetQuestion) return false;
      if (statusSource[targetQuestion.id] !== "skipped") return true;

      const key = `kgm-hiring-assessment-question-timer-${section.slug}-${targetQuestion.id}`;
      const storedRemaining = readStoredNumber(`${key}-remaining`);
      const serverRemaining = remainingSource?.[targetQuestion.id];
      const remainingSeconds = Math.max(
        0,
        Math.ceil(
          storedRemaining ??
            finiteNumberOrNull(serverRemaining) ??
            0,
        ),
      );

      if (remainingSeconds <= 0) {
        const next: Record<string, QuestionStatus> = {
          ...statusSource,
          ...questionStatusesRef.current,
          [targetQuestion.id]: "unanswered",
        };
        questionStatusesRef.current = next;
        window.localStorage.setItem(QUESTION_STATUS_STORAGE_KEY, JSON.stringify(next));
        setQuestionStatuses(next);
        clearStoredDeadline(key);
        window.localStorage.setItem(`${key}-remaining`, "0");
        window.sessionStorage.setItem(`${key}-remaining`, "0");
        return false;
      }

      const nextDeadline = Date.now() + remainingSeconds * 1000;
      const nextStatuses: Record<string, QuestionStatus> = {
        ...statusSource,
        ...questionStatusesRef.current,
      };
      delete nextStatuses[targetQuestion.id];

      writeStoredDeadline(key, nextDeadline);
      clearStoredDeadline(`${key}-remaining`);
      questionStatusesRef.current = nextStatuses;
      window.localStorage.setItem(QUESTION_STATUS_STORAGE_KEY, JSON.stringify(nextStatuses));
      setQuestionStatuses(nextStatuses);

      if (targetQuestion.id === currentQuestionId) {
        questionTimerEndAtRef.current = nextDeadline;
        setQuestionTimeLeftSeconds(remainingSeconds);
      }

      return true;
    },
    [
      activeAttempt?.questionRemainingSeconds,
      currentQuestionId,
      section.questions,
      section.slug,
    ],
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionStatusesRef.current = questionStatuses;
  }, [questionStatuses]);

  useEffect(() => {
    if (!activeAttempt) return;
    if (restoredAttemptKeyRef.current === activeAttemptRestoreKey) return;
    restoredAttemptKeyRef.current = activeAttemptRestoreKey;

    const activeQuestionIdSet = new Set(
      activeSections.flatMap((assessmentSection) =>
        assessmentSection.questions.map((question) => question.id),
      ),
    );
    const localActiveAnswers = Object.fromEntries(
      Object.entries(answers).filter(([questionId]) =>
        activeQuestionIdSet.has(questionId),
      ),
    );
    const restoredAnswers = {
      ...activeAttempt.answers,
      ...localActiveAnswers,
    };

    if (Object.keys(restoredAnswers).length) {
      writeStoredAnswers(restoredAnswers);
    }

    const localActiveStatuses = Object.fromEntries(
      Object.entries(readQuestionStatuses()).filter(([questionId]) =>
        activeQuestionIdSet.has(questionId),
      ),
    ) as Record<string, QuestionStatus>;
    const restoredQuestionStatuses = {
      ...activeAttempt.questionStatuses,
      ...localActiveStatuses,
    };

    if (Object.keys(restoredQuestionStatuses).length) {
      questionStatusesRef.current = restoredQuestionStatuses;
      window.localStorage.setItem(
        QUESTION_STATUS_STORAGE_KEY,
        JSON.stringify(restoredQuestionStatuses),
      );
      window.setTimeout(() => setQuestionStatuses(restoredQuestionStatuses), 0);
    }

    const serverTimeOffsetMs = activeAttempt.serverNow
      ? Date.now() - new Date(activeAttempt.serverNow).getTime()
      : 0;

    Object.entries(activeAttempt.sectionDeadlines ?? {}).forEach(([slug, deadline]) => {
      const value = new Date(deadline).getTime() + serverTimeOffsetMs;
      if (Number.isFinite(value)) {
        writeStoredDeadline(`kgm-hiring-assessment-timer-${slug}`, value);
      }
    });

    Object.entries(activeAttempt.questionDeadlines ?? {}).forEach(([questionId, deadline]) => {
      const value = new Date(deadline).getTime() + serverTimeOffsetMs;
      if (Number.isFinite(value)) {
        const question = activeSections
          .flatMap((assessmentSection) => assessmentSection.questions.map((item) => ({
            sectionSlug: assessmentSection.slug,
            questionId: item.id,
          })))
          .find((item) => item.questionId === questionId);

        if (question) {
          const key = `kgm-hiring-assessment-question-timer-${question.sectionSlug}-${questionId}`;
          const hasPausedRemaining = readStoredNumber(`${key}-remaining`) !== null;
          const hasServerPausedRemaining =
            activeAttempt.questionRemainingSeconds?.[questionId] !== undefined;
          if (
            restoredQuestionStatuses[questionId] !== "skipped" ||
            (!hasPausedRemaining && !hasServerPausedRemaining)
          ) {
            writeStoredDeadline(key, value);
          }
        }
      }
    });

    Object.entries(activeAttempt.questionRemainingSeconds ?? {}).forEach(([questionId, seconds]) => {
      if (restoredQuestionStatuses[questionId] !== "skipped") return;
      if (!Number.isFinite(seconds) || seconds <= 0) return;

      const question = activeSections
        .flatMap((assessmentSection) => assessmentSection.questions.map((item) => ({
          sectionSlug: assessmentSection.slug,
          questionId: item.id,
        })))
        .find((item) => item.questionId === questionId);

      if (!question) return;

      const key = `kgm-hiring-assessment-question-timer-${question.sectionSlug}-${questionId}`;
      window.localStorage.setItem(`${key}-remaining`, String(Math.ceil(seconds)));
      window.sessionStorage.setItem(`${key}-remaining`, String(Math.ceil(seconds)));
      clearStoredDeadline(key);
    });

    const restoreLocationKey = `${activeAttempt.id}|${section.slug}`;
    if (
      activeAttempt.currentQuestionId &&
      restoredAttemptLocationRef.current !== restoreLocationKey
    ) {
      restoredAttemptLocationRef.current = restoreLocationKey;
      const restoredIndex = section.questions.findIndex(
        (question) => question.id === activeAttempt.currentQuestionId,
      );
      if (restoredIndex >= 0) {
        window.setTimeout(() => {
          if (
            activeAttempt.currentQuestionId &&
            restoredQuestionStatuses[activeAttempt.currentQuestionId] === "skipped" &&
            !activateSkippedQuestion(
              restoredIndex,
              restoredQuestionStatuses,
              activeAttempt.questionRemainingSeconds,
            )
          ) {
            return;
          }

          setCurrentIndex(restoredIndex);
        }, 0);
      }
    }
  }, [activateSkippedQuestion, activeAttempt, activeAttemptRestoreKey, activeSections, answers, section.questions, section.slug]);

  useEffect(() => {
    if (!currentQuestionId) return;
    window.localStorage.setItem(CURRENT_SECTION_STORAGE_KEY, section.slug);
    window.localStorage.setItem(CURRENT_QUESTION_STORAGE_KEY, currentQuestionId);
  }, [currentQuestionId, section.slug]);

  useEffect(() => {
    function requestProgressRetry() {
      setProgressRetryNonce((value) => value + 1);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestProgressRetry();
      }
    }

    window.addEventListener("online", requestProgressRetry);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", requestProgressRetry);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!activeCandidateId || !activeAssessment?.id) return;
    if (!currentQuestionId) return;

    const timeoutId = window.setTimeout(() => {
      void saveAssessmentAttemptProgress({
        candidateId: activeCandidateId,
        assessmentId: activeAssessment.id,
        answers: JSON.parse(answersSnapshot) as Record<string, string>,
        questionStatuses,
        questionRemainingSeconds: collectQuestionRemainingSeconds(),
        questionDeadlines: collectQuestionDeadlineUpdates(),
        currentSectionSlug: section.slug,
        currentQuestionId,
        questionDurations: {
          [currentQuestionId]: questionDurationSeconds,
        },
        violations: readAssessmentViolations(),
      }).catch(() => undefined);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeAssessment?.id, activeCandidateId, answersSnapshot, collectQuestionDeadlineUpdates, collectQuestionRemainingSeconds, currentQuestionId, progressRetryNonce, questionDurationSeconds, questionStatuses, section.slug]);

  useEffect(() => {
    if (!Number.isFinite(inviteExpiryTime)) return;

    function updateInviteExpiry() {
      setIsInviteExpired(inviteExpiryTime <= Date.now());
    }

    updateInviteExpiry();
    const intervalId = window.setInterval(updateInviteExpiry, 1000);
    return () => window.clearInterval(intervalId);
  }, [inviteExpiryTime]);

  async function submitAssessment(status: "Submitted" | "Auto submitted") {
    if (isSubmittingAssessmentRef.current || showCompletionDialog) {
      return;
    }

    if (isInviteExpired) {
      toast.error("This assessment invitation has expired. Submission is closed.");
      return;
    }

    isSubmittingAssessmentRef.current = true;
    setIsSubmittingAssessment(true);
    setShowSubmitConfirm(false);
    setShowWindowWarning(false);
    try {
      await saveAssessmentResult({
        answers: answersRef.current,
        status,
      });
      hasSubmissionCompletedRef.current = true;
      isStoppingAssessmentRef.current = true;
      await exitAssessmentFullscreen();
      setSubmissionStatus(status);
      setIsSubmittingAssessment(false);
      setShowCompletionDialog(true);
    } catch (error) {
      isSubmittingAssessmentRef.current = false;
      setIsSubmittingAssessment(false);
      toast.error(error instanceof Error ? error.message : "Submission could not be saved.");
    }
  }

  useEffect(() => {
    submitAssessmentRef.current = submitAssessment;
  });

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
      if (isStoppingAssessmentRef.current || hasSubmissionCompletedRef.current) {
        return;
      }

      if (windowWarningQueuedRef.current) {
        return;
      }

      const violations = createViolation(section.slug, reason);
      const nextViolationCount = violations.length;

      setViolationCount(nextViolationCount);
      setLastViolationNumber(nextViolationCount);

      windowWarningQueuedRef.current = true;
      flushSync(() => {
        setShowWindowWarning(true);
      });
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (hasSubmissionCompletedRef.current || showCompletionDialog) {
        return;
      }

      showWarning("Tried to leave or reload assessment");
      event.preventDefault();
      event.returnValue = "";
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

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [section.slug, showCompletionDialog]);

  useEffect(() => {
    const serverTimeOffsetMs = activeAttempt?.serverNow
      ? Date.now() - new Date(activeAttempt.serverNow).getTime()
      : 0;
    const serverEndAt = activeAttempt?.sectionDeadlines?.[section.slug]
      ? new Date(activeAttempt.sectionDeadlines[section.slug]).getTime() + serverTimeOffsetMs
      : null;
    const storedEndAt = serverEndAt ?? readStoredDeadline(timerStorageKey);
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
  }, [activeAttempt, section.slug, sectionDurationSeconds, timerStorageKey]);

  useEffect(() => {
    if (!currentQuestionId) return;

    const currentStatus = questionStatuses[currentQuestionId];
    if (currentStatus === "skipped") {
      const storedRemaining = readStoredNumber(questionRemainingStorageKey);
      const serverRemaining = activeAttempt?.questionRemainingSeconds?.[currentQuestionId];
      const remainingSeconds = Math.max(
        0,
        Math.ceil(
          storedRemaining ??
            finiteNumberOrNull(serverRemaining) ??
            0,
        ),
      );

      questionTimerEndAtRef.current = null;
      const timeoutId = window.setTimeout(() => {
        setQuestionTimeLeftSeconds(remainingSeconds);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const serverTimeOffsetMs = activeAttempt?.serverNow
      ? Date.now() - new Date(activeAttempt.serverNow).getTime()
      : 0;
    const serverEndAt = activeAttempt?.questionDeadlines?.[currentQuestionId]
      ? new Date(activeAttempt.questionDeadlines[currentQuestionId]).getTime() + serverTimeOffsetMs
      : null;
    const storedEndAt = readStoredDeadline(questionTimerStorageKey) ?? serverEndAt;
    const endAt =
      storedEndAt ??
      Date.now() + questionDurationSeconds * 1000;
    questionTimerEndAtRef.current = endAt;

    if (!storedEndAt) {
      writeStoredDeadline(questionTimerStorageKey, endAt);
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
  }, [activeAttempt, currentQuestionId, questionDurationSeconds, questionRemainingStorageKey, questionStatuses, questionTimerStorageKey]);

  function writeQuestionStatus(questionId: string, status: QuestionStatus) {
    const next = { ...questionStatusesRef.current, [questionId]: status };
    questionStatusesRef.current = next;
    window.localStorage.setItem(QUESTION_STATUS_STORAGE_KEY, JSON.stringify(next));
    setQuestionStatuses(next);
    return next;
  }

  function clearQuestionStatus(questionId: string) {
    if (!questionStatusesRef.current[questionId]) return questionStatusesRef.current;

    const next = { ...questionStatusesRef.current };
    delete next[questionId];
    questionStatusesRef.current = next;
    window.localStorage.setItem(QUESTION_STATUS_STORAGE_KEY, JSON.stringify(next));
    setQuestionStatuses(next);
    return next;
  }

  function moveToQuestion(index: number) {
    if (isTimeUp) return;
    if (index === safeCurrentIndex) {
      if (currentQuestionId && questionStatusesRef.current[currentQuestionId] === "skipped") {
        activateSkippedQuestion(index);
      }
      return;
    }
    if (!canOpenQuestion(index)) return;
    if (!activateSkippedQuestion(index)) return;
    setCurrentIndex(index);
  }

  const getOpenQuestionTimeLeft = useCallback((
    assessmentSection: AssessmentSection,
    targetQuestion: AssessmentSection["questions"][number],
  ) => {
    const targetStatus = questionStatusesRef.current[targetQuestion.id];
    const targetDurationSeconds = getQuestionDurationInSection(
      assessmentSection,
      targetQuestion,
    );
    const targetKey = getQuestionTimerStorageKey(
      assessmentSection.slug,
      targetQuestion.id,
    );
    const storedRemaining = readStoredNumber(`${targetKey}-remaining`);
    const serverRemaining = activeAttempt?.questionRemainingSeconds?.[targetQuestion.id];
    const targetTimeLeft = getStoredQuestionTimeLeft(
      targetKey,
      targetDurationSeconds,
    );
    const skippedTimeLeft = Math.max(
      0,
      Math.ceil(
        storedRemaining ??
          finiteNumberOrNull(serverRemaining) ??
          0,
      ),
    );

    return targetStatus === "skipped" ? skippedTimeLeft : targetTimeLeft;
  }, [activeAttempt?.questionRemainingSeconds]);

  const canOpenQuestionInSection = useCallback((
    assessmentSection: AssessmentSection,
    targetQuestion: AssessmentSection["questions"][number],
  ) => {
    const targetStatus = questionStatusesRef.current[targetQuestion.id];

    return (
      targetStatus !== "answered" &&
      targetStatus !== "unanswered" &&
      getOpenQuestionTimeLeft(assessmentSection, targetQuestion) > 0
    );
  }, [getOpenQuestionTimeLeft]);

  const canOpenQuestion = useCallback((index: number) => {
    const targetQuestion = section.questions[index];
    if (!targetQuestion) return false;

    return canOpenQuestionInSection(section, targetQuestion);
  }, [canOpenQuestionInSection, section]);

  const findNextOpenQuestionIndex = useCallback((startIndex: number, wrap = false, excludedIndex?: number) => {
    for (let index = startIndex; index < section.questions.length; index += 1) {
      if (index === excludedIndex) continue;
      if (canOpenQuestion(index)) return index;
    }

    if (wrap) {
      for (let index = 0; index < Math.min(startIndex, section.questions.length); index += 1) {
        if (index === excludedIndex) continue;
        if (canOpenQuestion(index)) return index;
      }
    }

    return null;
  }, [canOpenQuestion, section.questions.length]);

  const findNextIncompleteSectionSlug = useCallback((startIndex: number, excludedSlug?: string) => {
    if (!activeSections.length) return null;

    for (let offset = 0; offset < activeSections.length; offset += 1) {
      const index = (startIndex + offset + activeSections.length) % activeSections.length;
      const targetSection = activeSections[index];

      if (!targetSection || targetSection.slug === excludedSlug) continue;

      const hasOpenQuestion = targetSection.questions.some((question) =>
        canOpenQuestionInSection(targetSection, question),
      );

      if (hasOpenQuestion) return targetSection.slug;
    }

    return null;
  }, [activeSections, canOpenQuestionInSection]);

  function moveToNextAvailableQuestionOrSection(startIndex: number, excludedIndex?: number) {
    const nextIndex = findNextOpenQuestionIndex(startIndex, true, excludedIndex);
    if (nextIndex !== null) {
      setCurrentIndex(nextIndex);
      return true;
    }

    const nextOpenSectionSlug = findNextIncompleteSectionSlug(sectionIndex + 1, section.slug);

    if (nextOpenSectionSlug) {
      setIsChangingSection(true);
      router.push(`/assessment/${nextOpenSectionSlug}`);
      return true;
    }

    return false;
  }

  const hasOtherOpenQuestionInCurrentSection =
    findNextOpenQuestionIndex(safeCurrentIndex + 1, true, safeCurrentIndex) !== null;
  const nextIncompleteSectionSlug = findNextIncompleteSectionSlug(
    sectionIndex + 1,
    section.slug,
  );
  const isLastRemainingQuestionInSection = !hasOtherOpenQuestionInCurrentSection;
  const shouldMoveToNextIncompleteSection =
    isLastRemainingQuestionInSection && Boolean(nextIncompleteSectionSlug);
  const shouldSubmitAfterCurrentAnswer =
    isLastRemainingQuestionInSection && !nextIncompleteSectionSlug;
  const primaryActionLabel = shouldMoveToNextIncompleteSection
    ? "Next Section"
    : shouldSubmitAfterCurrentAnswer
      ? "Submit Test"
      : "Next";

  useEffect(() => {
    if (!currentQuestionId || isTimeUp) return;

    const currentStatus = questionStatusesRef.current[currentQuestionId];
    if (currentStatus !== "answered" && currentStatus !== "unanswered") return;

    const nextOpenIndex = findNextOpenQuestionIndex(0, false, safeCurrentIndex);
    if (nextOpenIndex === null) return;

    const timeoutId = window.setTimeout(() => {
      setCurrentIndex(nextOpenIndex);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [answersSnapshot, currentQuestionId, findNextOpenQuestionIndex, isTimeUp, questionStatuses, safeCurrentIndex, section.slug]);

  function markCurrentQuestionSkipped() {
    if (
      !currentQuestionId ||
      isTimeUp ||
      isQuestionTimeUp ||
      questionStatusesRef.current[currentQuestionId] === "answered" ||
      questionStatusesRef.current[currentQuestionId] === "unanswered"
    ) {
      return false;
    }

    window.localStorage.setItem(
      questionRemainingStorageKey,
      String(Math.max(0, questionTimeLeftSeconds)),
    );
    window.sessionStorage.setItem(
      questionRemainingStorageKey,
      String(Math.max(0, questionTimeLeftSeconds)),
    );
    clearStoredDeadline(questionTimerStorageKey);
    questionTimerEndAtRef.current = null;
    writeQuestionStatus(currentQuestionId, "skipped");
    return true;
  }

  function skipCurrentQuestion() {
    if (!markCurrentQuestionSkipped()) {
      return;
    }

    if (!moveToNextAvailableQuestionOrSection(safeCurrentIndex + 1, safeCurrentIndex)) {
      activateSkippedQuestion(safeCurrentIndex);
      toast.info("No other available question remains in this section.");
    }
  }

  function submitCurrentAnswer() {
    if (
      !currentQuestionId ||
      !answersRef.current[currentQuestionId]?.trim() ||
      isQuestionTimeUp ||
      isTimeUp
    ) {
      return false;
    }

    writeQuestionStatus(currentQuestionId, "answered");
    window.localStorage.removeItem(questionRemainingStorageKey);
    window.sessionStorage.removeItem(questionRemainingStorageKey);
    return true;
  }

  useEffect(() => {
    if (!currentQuestionId || !isQuestionTimeUp || isTimeUp) return;

    const timeoutId = window.setTimeout(() => {
      setQuestionStatuses((current) => {
        const next: Record<string, QuestionStatus> = {
          ...current,
          [currentQuestionId]: "unanswered",
        };
        questionStatusesRef.current = next;
        window.localStorage.setItem(QUESTION_STATUS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      window.sessionStorage.setItem(questionRemainingStorageKey, "0");
      window.localStorage.setItem(questionRemainingStorageKey, "0");
      window.sessionStorage.removeItem(questionTimerStorageKey);
      window.localStorage.removeItem(questionTimerStorageKey);
      const nextIndex = findNextOpenQuestionIndex(safeCurrentIndex + 1, true);
      if (nextIndex !== null) {
        setCurrentIndex(nextIndex);
      } else {
        const nextOpenSectionSlug = findNextIncompleteSectionSlug(
          sectionIndex + 1,
          section.slug,
        );
        if (!nextOpenSectionSlug) return;

        setIsChangingSection(true);
        router.push(`/assessment/${nextOpenSectionSlug}`);
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [currentQuestionId, findNextIncompleteSectionSlug, findNextOpenQuestionIndex, isQuestionTimeUp, isTimeUp, questionRemainingStorageKey, questionTimerStorageKey, router, safeCurrentIndex, section.slug, sectionIndex]);

  useEffect(() => {
    if (
      !isTimeUp ||
      hasAutoSubmittedRef.current ||
      showCompletionDialog ||
      activeAssessmentSubmitted ||
      !activeCandidate
    ) {
      return;
    }

    hasAutoSubmittedRef.current = true;
    setQuestionStatuses((current) => {
      const next = { ...current };
      section.questions.forEach((question) => {
        if (!answersRef.current[question.id]?.trim()) {
          next[question.id] = "unanswered";
        }
      });
      questionStatusesRef.current = next;
      window.localStorage.setItem(QUESTION_STATUS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    void submitAssessmentRef.current?.("Auto submitted");
  }, [activeAssessmentSubmitted, activeCandidate, isTimeUp, section.questions, showCompletionDialog]);

  useEffect(() => {
    router.prefetch("/assessment");

    activeSectionSlugKey
      .split("|")
      .filter((slug) => slug && slug !== section.slug)
      .forEach((slug) => router.prefetch(`/assessment/${slug}`));
  }, [activeSectionSlugKey, router, section.slug]);

  function updateAnswer(questionId: string, value: string) {
    if (isAnswerLocked || questionStatusesRef.current[questionId] === "answered") {
      return;
    }

    if (
      questionId === currentQuestionId &&
      questionStatusesRef.current[questionId] === "skipped" &&
      !activateSkippedQuestion(safeCurrentIndex)
    ) {
      return;
    }

    const nextAnswers = {
      ...answersRef.current,
      [questionId]: value,
    };

    clearQuestionStatus(questionId);
    answersRef.current = nextAnswers;
    writeStoredAnswers(nextAnswers);
  }

  function toggleMultiAnswer(questionId: string, option: string) {
    if (isAnswerLocked || questionStatusesRef.current[questionId] === "answered") {
      return;
    }

    if (
      questionId === currentQuestionId &&
      questionStatusesRef.current[questionId] === "skipped" &&
      !activateSkippedQuestion(safeCurrentIndex)
    ) {
      return;
    }

    const existingValue = answersRef.current[questionId] ?? "";
    const existingValues = existingValue
      ? existingValue.split("||").filter(Boolean)
      : [];
    const isSelected = existingValues.includes(option);
    const nextValues = isSelected
      ? existingValues.filter((value) => value !== option)
      : [...existingValues, option];

    clearQuestionStatus(questionId);
    const nextAnswers = {
      ...answersRef.current,
      [questionId]: nextValues.join("||"),
    };
    answersRef.current = nextAnswers;
    writeStoredAnswers(nextAnswers);
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
    await submitAssessment("Submitted");
  }

  function leaveTimedOutSection() {
    finishSubmittedAssessment();
  }

  function finishSubmittedAssessment() {
    setShowCompletionDialog(false);
    void exitAssessmentFullscreen();
    window.location.replace("/jobs");
  }

  function requestManualSubmit() {
    if (isSubmittingAssessment) return;
    if (
      currentQuestionId &&
      answersRef.current[currentQuestionId]?.trim() &&
      questionStatusesRef.current[currentQuestionId] !== "answered"
    ) {
      writeQuestionStatus(currentQuestionId, "answered");
    }
    setShowSubmitConfirm(true);
  }

  function readQuestionAloud() {
    if (!currentQuestion) return;
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

  if (showCompletionDialog) {
    return (
      <Dialog open={showCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <CheckCircle2 className="size-5" />
            </div>
            <DialogTitle>Test submitted</DialogTitle>
            <DialogDescription>
              {submissionStatus === "Auto submitted"
                ? "Time is up. Your assessment was submitted successfully and this OTP can no longer be used."
                : "Your assessment was submitted successfully. Thank you for completing it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={finishSubmittedAssessment}>Go to jobs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (isSubmittingAssessment) {
    return (
      <Dialog open={isSubmittingAssessment}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Send className="size-5" />
            </div>
            <DialogTitle>Submitting your assessment</DialogTitle>
            <DialogDescription>
              Submitting your assessment, please wait. Keep this page open and
              do not refresh, close, or resubmit while we complete the process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-md border bg-muted/20 p-4">
            <div className="flex items-center gap-3 text-sm font-medium">
              <Send className="size-4 animate-pulse text-primary" />
              <span>Submitting your assessment, please wait...</span>
            </div>
            <Progress value={75} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Your submission is being saved. This usually takes a few seconds.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!activeCandidate || activeAssessmentSubmitted || isInviteExpired) {
    return (
      <main className="min-h-svh bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8">
        <CandidateThemeCorner />
        <section className="mx-auto w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Assessment unavailable</CardTitle>
              <CardDescription>
                {isInviteExpired
                  ? "This assessment invitation has expired. You can no longer start, continue, or submit this assessment."
                  : "This assessment is already submitted or no active candidate session is available."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/jobs">Go to jobs</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="min-h-svh bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8">
        <CandidateThemeCorner />
        <section className="mx-auto w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Assessment unavailable</CardTitle>
              <CardDescription>
                This section has no available questions. Please return to the
                assessment overview and choose another section.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/assessment">Back to assessment overview</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
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
        <CandidateThemeCorner />
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
                  Question {safeCurrentIndex + 1} of {section.questions.length}
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
                  const status = questionStatuses[question.id];
                  const isAnswered =
                    Boolean(answers[question.id]?.trim()) && status === "answered";
                  const durationSeconds =
                    question.timeLimitSeconds ?? section.questionTimeSeconds ??
                    Math.max(1, Math.floor(sectionDurationSeconds / section.questions.length));
                  const questionTimeLeft = getStoredQuestionTimeLeft(
                    `kgm-hiring-assessment-question-timer-${section.slug}-${question.id}`,
                    durationSeconds,
                  );
                  const isSkipped = status === "skipped" && !isAnswered;
                  const isExpired = status === "unanswered" || questionTimeLeft <= 0;
                  const isCurrent = index === safeCurrentIndex;
                  const statusLabel = isCurrent
                    ? "Current"
                    : isAnswered
                      ? "Attempted"
                      : isSkipped
                        ? "Skipped"
                      : isExpired
                        ? "Time expired"
                          : "Pending";
                  return (
                    <Button
                      className={[
                        "justify-between border",
                        isCurrent
                          ? "border-primary/50 bg-primary/10 text-foreground shadow-none hover:bg-primary/15"
                          : "bg-background hover:bg-muted/60",
                      ].join(" ")}
                      key={question.id}
                      onClick={() => {
                        moveToQuestion(index);
                      }}
                      disabled={isTimeUp || (!isCurrent && (isAnswered || isExpired))}
                      variant="outline"
                    >
                      <span>Question {index + 1}</span>
                      <span className="inline-flex items-center gap-2">
                        {isSkipped ? (
                          <span className="text-xs font-medium text-sky-600">
                            Skipped
                          </span>
                        ) : null}
                        <span
                          aria-label={statusLabel}
                          className={[
                            "inline-flex size-6 items-center justify-center rounded-full border",
                            isCurrent
                              ? "border-primary/30 bg-primary/15 text-primary"
                              : isAnswered
                              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600"
                              : isSkipped
                                ? "border-sky-500/30 bg-sky-500/15 text-sky-600"
                              : isExpired
                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-amber-500/30 bg-amber-500/15 text-amber-600",
                          ].join(" ")}
                          title={statusLabel}
                        >
                          {isCurrent ? (
                            <CircleDot className="size-4" aria-hidden="true" />
                          ) : isAnswered ? (
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                          ) : isSkipped ? (
                            <SkipForward className="size-4" aria-hidden="true" />
                          ) : isExpired ? (
                            <Lock className="size-4" aria-hidden="true" />
                          ) : (
                            <TriangleAlert className="size-4" aria-hidden="true" />
                          )}
                        </span>
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
                <Link href="/assessment">
                  <ArrowLeft className="size-4" />
                  All sections
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                
                <Button onClick={requestManualSubmit}>
                  Submit Test
                  <Send className="size-4" />
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardDescription>
                  {section.title} - Question {safeCurrentIndex + 1}
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
                    disabled={isFirstQuestion || !canOpenQuestion(safeCurrentIndex - 1)}
                    onClick={() => {
                      moveToQuestion(safeCurrentIndex - 1);
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
                    disabled={isTimeUp || isQuestionTimeUp || isCurrentQuestionSubmitted}
                    onClick={skipCurrentQuestion}
                  >
                    Skip for now
                  </Button>
                  <Button
                    disabled={isTimeUp || !hasCurrentAnswer || isSubmittingAssessment}
                    onClick={() => {
                      if (!submitCurrentAnswer()) {
                        return;
                      }

                      if (shouldMoveToNextIncompleteSection && nextIncompleteSectionSlug) {
                        setIsChangingSection(true);
                        router.push(`/assessment/${nextIncompleteSectionSlug}`);
                        return;
                      }

                      if (shouldSubmitAfterCurrentAnswer) {
                        setShowSubmitConfirm(true);
                        return;
                      }

                      if (!moveToNextAvailableQuestionOrSection(safeCurrentIndex + 1)) {
                        setShowSubmitConfirm(true);
                      }
                    }}
                  >
                    {primaryActionLabel}
                    {shouldSubmitAfterCurrentAnswer ? (
                      <Send className="size-4" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                  </Button>
                  </div>
                </div>
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
              recorded. The assessment must stay in fullscreen. Violations are
              recorded for admin review, but you can continue after returning
              to fullscreen.
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

      <Dialog open={showSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Send className="size-5" />
            </div>
            <DialogTitle>Submit assessment?</DialogTitle>
            <DialogDescription>
              You can submit now, even if some questions are skipped or pending.
              After submission, this assessment will be locked permanently and
              cannot be reopened or edited.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <span className="font-medium">{totalAnsweredCount}</span> of{" "}
            <span className="font-medium">{totalQuestionCount}</span> questions
            currently have saved answers.
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSubmittingAssessment}
              onClick={() => setShowSubmitConfirm(false)}
            >
              Continue assessment
            </Button>
            <Button
              disabled={isSubmittingAssessment}
              onClick={() => {
                setShowSubmitConfirm(false);
                void submitAssessment("Submitted");
              }}
            >
              {isSubmittingAssessment ? "Submitting..." : "Submit assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTimeUp && !showCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-destructive text-white">
              <Clock3 className="size-5" />
            </div>
            <DialogTitle>Time is up</DialogTitle>
            <DialogDescription>
              Time is up. Your saved answers are being submitted automatically.
              You can go to the jobs page after the submission is saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={leaveTimedOutSection}>Go to jobs</Button>
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
                ? "Time is up. Your assessment was submitted successfully and this OTP can no longer be used."
                : "Your assessment was submitted successfully. Thank you for completing it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={finishSubmittedAssessment}>Go to jobs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
