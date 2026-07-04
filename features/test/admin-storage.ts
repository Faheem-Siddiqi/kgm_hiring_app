"use client";

import {
  assessmentSections,
  type AssessmentSection,
} from "@/features/test/assessment-data";
import {
  assessmentResourceSummaries,
  buildAssessmentSectionsFromResource,
  getAssessmentResource,
} from "@/features/test/assessment-resources";
import type { AssessmentAnswers } from "@/features/test/assessment-storage";
import type { SectionQuestionTypeConfig } from "@/features/test/assessment-resources";
import type { PublicAssessment } from "@/lib/assessment-types";

export type Candidate = {
  id: string;
  name: string;
  email: string;
  jobId: string;
  jobAssignmentId?: string;
  jobTitle?: string;
  assessmentIds?: string[];
  otpCode: string;
  canViewOtp?: boolean;
  cvUrl: string;
  invitedAt: string;
  inviteExpiresAt: string;
  isInviteExpired: boolean;
  inviteEmailStatus?: "pending" | "sent" | "failed";
  inviteEmailFailure?: string;
  submittedAt?: string;
};

export type JobAssessment = {
  id: string;
  title: string;
  role: string;
  createdAt: string;
  resourceId: string;
  sectionCount: number;
  timePerSectionMinutes: number;
  questionsPerTest: number;
  questionsPerSection: number;
  dummyQuestionsPerSection: number;
  sectionTypeConfigs?: Record<string, SectionQuestionTypeConfig>;
};

export type AssessmentViolation = {
  id: string;
  sectionSlug: string;
  sectionTitle: string;
  reason: string;
  occurredAt: string;
};

export type AssessmentResult = {
  id: string;
  assessmentId: string;
  candidateId?: string;
  assessmentTitle: string;
  candidateName: string;
  candidateEmail: string;
  submittedAt: string;
  answeredCount: number;
  totalQuestions: number;
  score: number;
  status: "Submitted" | "Auto submitted";
  violations: AssessmentViolation[];
  answers?: AssessmentAnswers;
  textScores?: Record<string, number>;
  evaluatedAt?: string;
  evaluatedBy?: {
    name: string;
    email: string;
  };
  decision?: "accepted" | "rejected" | "forwarded";
  reviews?: Array<{
    id: string;
    adminName: string;
    adminEmail: string;
    action: "evaluated" | "accepted" | "rejected" | "forwarded";
    createdAt: string;
  }>;
};

export type CandidateAttempt = {
  id: string;
  candidateId: string;
  assessmentId: string;
  status: "Not Started" | "In Progress" | "Submitted" | "Expired";
  startedAt?: string;
  updatedAt: string;
  currentSectionSlug?: string;
  currentQuestionId?: string;
  answers: AssessmentAnswers;
  questionStatuses: Record<string, "answered" | "skipped" | "unanswered">;
  questionRemainingSeconds: Record<string, number>;
  sectionDeadlines: Record<string, string>;
  questionDeadlines: Record<string, string>;
  violations: AssessmentViolation[];
  submittedAt?: string;
  serverNow: string;
};

const JOBS_STORAGE_KEY = "kgm-hiring-admin-jobs";
const CANDIDATES_STORAGE_KEY = "kgm-hiring-admin-candidates";
const RESULTS_STORAGE_KEY = "kgm-hiring-admin-results";
const ATTEMPTS_STORAGE_KEY = "kgm-hiring-candidate-attempts";
const ACTIVE_JOB_STORAGE_KEY = "kgm-hiring-active-assessment-id";
export const VIOLATIONS_STORAGE_KEY = "kgm-hiring-assessment-violations";
export const QUESTION_STATUS_STORAGE_KEY = "kgm-hiring-assessment-question-statuses";

const defaultJobs: JobAssessment[] = [];
const defaultCandidates: Candidate[] = [];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function readJson<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("kgm-hiring-admin-data-change"));
}

function clearBrowserStorageByPrefix(prefix: string) {
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) {
        storage.removeItem(key);
      }
    }
  });
}

function isExpired(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

export function subscribeToAdminData(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("kgm-hiring-admin-data-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("kgm-hiring-admin-data-change", onStoreChange);
  };
}

export function readAdminDataSnapshot() {
  if (typeof window === "undefined") {
    return "{}";
  }

  return JSON.stringify({
    candidates: readCandidates(),
    jobs: readJobAssessments(),
    results: readAssessmentResults(),
    attempts: readCandidateAttempts(),
  });
}

export function readJobAssessments() {
  return readJson<JobAssessment[]>(JOBS_STORAGE_KEY, defaultJobs).map((job) => ({
    ...job,
    resourceId: job.resourceId ?? "admin-officer",
    sectionCount: job.sectionCount ?? 3,
    timePerSectionMinutes: job.timePerSectionMinutes ?? 15,
    questionsPerTest: job.questionsPerTest ?? 20,
    questionsPerSection: job.questionsPerSection ?? job.questionsPerTest ?? 20,
    dummyQuestionsPerSection: job.dummyQuestionsPerSection ?? 3,
  }));
}

export function readCandidates() {
  return readJson<Candidate[]>(CANDIDATES_STORAGE_KEY, defaultCandidates);
}

function toJobAssessment(assessment: PublicAssessment): JobAssessment {
  const sectionTypeConfigs = Object.fromEntries(
    assessment.sectionSettings.map((section) => [section.sectionId, section.types]),
  );
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
    dummyQuestionsPerSection: 0,
    sectionTypeConfigs,
  };
}

export async function fetchAdminDataSnapshot() {
  const response = await fetch("/api/admin/hiring-records", { cache: "no-store" });
  const payload = (await response.json()) as {
    message?: string;
    candidates?: Candidate[];
    results?: AssessmentResult[];
    canViewCandidateOtp?: boolean;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Could not load admin hiring records.");
  }

  return {
    candidates: payload.candidates ?? [],
    results: payload.results ?? [],
    canViewCandidateOtp: payload.canViewCandidateOtp ?? false,
  };
}

export async function authenticateCandidate(otpCode: string) {
  const response = await fetch("/api/candidate/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otpCode }),
  });
  const payload = (await response.json()) as {
    message?: string;
    candidate?: Candidate;
    assessment?: PublicAssessment;
    assessments?: PublicAssessment[];
    attempts?: CandidateAttempt[];
  };

  if (!response.ok || !payload.candidate || !payload.assessment) {
    throw new Error(payload.message ?? "This access code is invalid, expired, or already submitted.");
  }

  const candidate = payload.candidate;
  const assessments = payload.assessments?.length ? payload.assessments : [payload.assessment];
  const jobs = assessments.map(toJobAssessment);
  jobs.forEach(upsertJobAssessment);
  const candidates = readCandidates();
  writeJson(
    CANDIDATES_STORAGE_KEY,
    candidates.some((item) => item.id === candidate.id)
      ? candidates.map((item) => (item.id === candidate.id ? candidate : item))
      : [candidate, ...candidates],
  );

  if (candidate) {
    writeJson(ATTEMPTS_STORAGE_KEY, payload.attempts ?? []);
    const submittedAssessmentIds = new Set(
      readAssessmentResults()
        .filter((result) => result.candidateId === candidate.id)
        .map((result) => result.assessmentId),
    );
    const nextAssessment =
      jobs.find((item) => !submittedAssessmentIds.has(item.id)) ?? jobs[0];
    writeActiveJobAssessment(nextAssessment.id);
    window.localStorage.setItem("kgm-hiring-active-candidate-id", candidate.id);
  }

  return candidate;
}

export function readAssessmentResults() {
  return readJson<AssessmentResult[]>(RESULTS_STORAGE_KEY, []);
}

export function readCandidateAttempts() {
  return readJson<CandidateAttempt[]>(ATTEMPTS_STORAGE_KEY, []);
}

function writeCandidateAttempt(attempt: CandidateAttempt) {
  const attempts = readCandidateAttempts();
  writeJson(
    ATTEMPTS_STORAGE_KEY,
    attempts.some((item) => item.id === attempt.id)
      ? attempts.map((item) => (item.id === attempt.id ? attempt : item))
      : [attempt, ...attempts],
  );
  return attempt;
}

function calculateAssessmentScore(
  sections: ReturnType<typeof readActiveAssessmentSections>,
  answers: AssessmentAnswers,
  textScores: Record<string, number> = {},
) {
  const questions = sections.flatMap((section) => section.questions);
  const totalPoints = questions.length;
  const earnedPoints = questions.reduce((total, question) => {
    if (question.type === "text") {
      return total + Math.min(10, Math.max(0, textScores[question.id] ?? 0)) / 10;
    }

    const expected = question.correctAnswers ?? [];
    const provided = (answers[question.id] ?? "").split("||").filter(Boolean);

    if (!expected.length) return total;
    if (question.type === "mcq") {
      return total + (provided[0] === expected[0] ? 1 : 0);
    }

    const correctSelections = provided.filter((value) => expected.includes(value)).length;
    const incorrectSelections = provided.filter((value) => !expected.includes(value)).length;
    const partialCredit = Math.max(
      0,
      correctSelections / expected.length - incorrectSelections / expected.length,
    );
    return total + partialCredit;
  }, 0);

  return totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
}

export function readAssessmentViolations() {
  return readJson<AssessmentViolation[]>(VIOLATIONS_STORAGE_KEY, []);
}

export function readActiveJobAssessment() {
  const jobs = readJobAssessments();

  if (typeof window === "undefined") {
    return jobs[0];
  }

  const activeJobId = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);

  return jobs.find((job) => job.id === activeJobId) ?? jobs[0];
}

export function writeActiveJobAssessment(jobId: string) {
  window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
  window.dispatchEvent(new Event("kgm-hiring-admin-data-change"));
}

export function readActiveAssessmentSections() {
  const job = readActiveJobAssessment();

  if (!job) {
    return assessmentSections;
  }

  return buildAssessmentSectionsFromResource({
    resourceId: job.resourceId,
    sectionCount: job.sectionCount,
    questionsPerSection: job.questionsPerSection,
    timePerSectionMinutes: job.timePerSectionMinutes,
    seed: job.id,
    sectionTypeConfigs: job.sectionTypeConfigs,
  });
}

export function writeAssessmentViolations(violations: AssessmentViolation[]) {
  writeJson(VIOLATIONS_STORAGE_KEY, violations);
}

export function createJobAssessment({
  title,
  resourceId,
  sectionCount,
  timePerSectionMinutes,
  questionsPerSection,
  dummyQuestionsPerSection = 3,
}: {
  title: string;
  resourceId: string;
  sectionCount: number;
  timePerSectionMinutes: number;
  questionsPerSection: number;
  dummyQuestionsPerSection?: number;
}) {
  const resource = getAssessmentResource(resourceId);
  const summary = assessmentResourceSummaries.find(
    (item) => item.id === resource.id,
  );
  const safeSectionCount = Math.min(
    Math.max(1, Math.round(sectionCount)),
    summary?.sectionCount ?? resource.sections.length,
  );
  const safeQuestionCount = Math.min(
    Math.max(1, Math.round(questionsPerSection)),
    summary?.maxQuestionsPerSection ?? 20,
  );
  const job: JobAssessment = {
    id: createId("job"),
    title,
    role: resource.role,
    createdAt: new Date().toISOString(),
    resourceId: resource.id,
    sectionCount: safeSectionCount,
    timePerSectionMinutes: Math.max(1, Math.round(timePerSectionMinutes)),
    questionsPerTest: safeQuestionCount,
    questionsPerSection: safeQuestionCount,
    dummyQuestionsPerSection: Math.max(
      0,
      Math.round(dummyQuestionsPerSection),
    ),
  };

  writeJson(JOBS_STORAGE_KEY, [job, ...readJobAssessments()]);
  writeActiveJobAssessment(job.id);
  return job;
}

export async function startOrResumeAssessmentAttempt(
  candidateId: string,
  assessmentId: string,
  sectionDurations: Record<string, number>,
  questionDurations: Record<string, number>,
) {
  const response = await fetch("/api/candidate/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateId,
      assessmentId,
      sectionDurations,
      questionDurations,
    }),
  });
  const payload = (await response.json()) as { message?: string; attempt?: CandidateAttempt };

  if (!response.ok || !payload.attempt) {
    throw new Error(payload.message ?? "Could not start assessment attempt.");
  }

  writeActiveJobAssessment(assessmentId);
  writeCandidateAttempt(payload.attempt);
  return payload.attempt;
}

export async function saveAssessmentAttemptProgress({
  candidateId,
  assessmentId,
  answers,
  questionStatuses,
  questionRemainingSeconds,
  questionDeadlines,
  currentSectionSlug,
  currentQuestionId,
  questionDurations,
  violations,
}: {
  candidateId: string;
  assessmentId: string;
  answers: AssessmentAnswers;
  questionStatuses: Record<string, "answered" | "skipped" | "unanswered">;
  questionRemainingSeconds?: Record<string, number>;
  questionDeadlines?: Record<string, string>;
  currentSectionSlug?: string;
  currentQuestionId?: string;
  questionDurations?: Record<string, number>;
  violations?: AssessmentViolation[];
}) {
  const response = await fetch("/api/candidate/attempts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateId,
      assessmentId,
      answers,
      questionStatuses,
      questionRemainingSeconds,
      questionDeadlines,
      currentSectionSlug,
      currentQuestionId,
      questionDurations,
      violations,
    }),
  });
  const payload = (await response.json()) as { message?: string; attempt?: CandidateAttempt };

  if (!response.ok || !payload.attempt) {
    throw new Error(payload.message ?? "Progress could not be saved.");
  }

  return writeCandidateAttempt(payload.attempt);
}

export function upsertJobAssessment(job: JobAssessment) {
  const existingJobs = readJobAssessments();
  const nextJobs = existingJobs.some((item) => item.id === job.id)
    ? existingJobs.map((item) => (item.id === job.id ? { ...item, ...job } : item))
    : [job, ...existingJobs];

  writeJson(JOBS_STORAGE_KEY, nextJobs);
  return job;
}

export function updateJobAssessmentConfig(
  id: string,
  updates: Pick<
    JobAssessment,
    | "sectionCount"
    | "timePerSectionMinutes"
    | "questionsPerTest"
    | "questionsPerSection"
    | "dummyQuestionsPerSection"
  >,
) {
  const jobs = readJobAssessments().map((job) => {
    if (job.id !== id) {
      return job;
    }

    const summary = assessmentResourceSummaries.find(
      (item) => item.id === job.resourceId,
    );
    const sectionCount = Math.min(
      Math.max(1, Math.round(updates.sectionCount)),
      summary?.sectionCount ?? job.sectionCount,
    );
    const questionsPerSection = Math.min(
      Math.max(
        1,
        Math.round(updates.questionsPerSection ?? updates.questionsPerTest),
      ),
      summary?.maxQuestionsPerSection ?? updates.questionsPerSection,
    );

    return {
      ...job,
      sectionCount,
      timePerSectionMinutes: Math.max(
        1,
        Math.round(updates.timePerSectionMinutes),
      ),
      questionsPerTest: questionsPerSection,
      questionsPerSection,
      dummyQuestionsPerSection: Math.max(
        0,
        Math.round(updates.dummyQuestionsPerSection),
      ),
    };
  });

  writeJson(JOBS_STORAGE_KEY, jobs);
}

export function updateSectionQuestionTypeConfig(
  jobId: string,
  sectionId: string,
  type: keyof SectionQuestionTypeConfig,
  updates: Partial<SectionQuestionTypeConfig[keyof SectionQuestionTypeConfig]>,
) {
  const createDefaults = (job: JobAssessment) => {
    const section = assessmentResourceSummaries
      .find((resource) => resource.id === job.resourceId)
      ?.sections.find((item) => item.id === sectionId);
    return {
      mcq: { quantity: Math.min(3, section?.counts.mcq ?? 0), timeLimitSeconds: 60 },
      multi: { quantity: Math.min(3, section?.counts.multi ?? 0), timeLimitSeconds: 90 },
      text: { quantity: Math.min(3, section?.counts.text ?? 0), timeLimitSeconds: 180 },
    };
  };
  const jobs = readJobAssessments().map((job) => {
    if (job.id !== jobId) return job;

    const defaults = createDefaults(job);
    const sectionConfig = job.sectionTypeConfigs?.[sectionId] ?? defaults;
    const current = sectionConfig[type];

    return {
      ...job,
      sectionTypeConfigs: {
        ...job.sectionTypeConfigs,
        [sectionId]: {
          ...sectionConfig,
          [type]: { ...current, ...updates },
        },
      },
    };
  });

  writeJson(JOBS_STORAGE_KEY, jobs);
}

export function saveSectionQuestionTypeConfigs(
  jobId: string,
  sectionTypeConfigs: Record<string, SectionQuestionTypeConfig>,
) {
  const jobs = readJobAssessments().map((job) =>
    job.id === jobId ? { ...job, sectionTypeConfigs } : job,
  );

  writeJson(JOBS_STORAGE_KEY, jobs);
}

export function createCandidate(name: string, email: string, jobId: string) {
  const candidate: Candidate = {
    id: createId("candidate"),
    name,
    email,
    jobId,
    otpCode: createOtpCode(),
    cvUrl: "https://drive.google.com/file/d/sample-cv-preview/view",
    invitedAt: new Date().toISOString(),
    inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isInviteExpired: false,
    inviteEmailStatus: "pending",
  };

  writeJson(CANDIDATES_STORAGE_KEY, [candidate, ...readCandidates()]);
  writeActiveJobAssessment(jobId);
  return candidate;
}

export async function createCandidateRecord(
  name: string,
  email: string,
  assignmentId: string,
  assignmentType: "assessment" | "job" = "assessment",
  inviteExpiresAt?: string,
) {
  const response = await fetch("/api/admin/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      inviteExpiresAt,
      ...(assignmentType === "job" ? { jobId: assignmentId } : { assessmentId: assignmentId }),
    }),
  });
  const payload = (await response.json()) as {
    message?: string;
    candidate?: Candidate;
    assessment?: PublicAssessment;
    assessments?: PublicAssessment[];
    existingPending?: boolean;
    canViewCandidateOtp?: boolean;
  };

  if (!response.ok || !payload.candidate) {
    throw new Error(payload.message ?? "Could not create candidate.");
  }

  const assessments = payload.assessments?.length
    ? payload.assessments
    : payload.assessment
      ? [payload.assessment]
      : [];
  assessments.forEach((assessment) => upsertJobAssessment(toJobAssessment(assessment)));

  return {
    candidate: payload.candidate,
    assessment: payload.assessment,
    existingPending: payload.existingPending ?? false,
    canViewCandidateOtp: payload.canViewCandidateOtp ?? false,
  };
}

export function updateCandidateInviteEmailStatus(
  candidateId: string,
  status: NonNullable<Candidate["inviteEmailStatus"]>,
  failure?: string | null,
) {
  const candidates = readCandidates().map((candidate) =>
    candidate.id === candidateId
      ? {
          ...candidate,
          inviteEmailStatus: status,
          inviteEmailFailure: failure ?? undefined,
        }
      : candidate,
  );

  writeJson(CANDIDATES_STORAGE_KEY, candidates);
  return candidates.find((candidate) => candidate.id === candidateId) ?? null;
}

export async function updateCandidateInviteEmailStatusRecord(
  candidateId: string,
  status: NonNullable<Candidate["inviteEmailStatus"]>,
  failure?: string | null,
) {
  const response = await fetch("/api/admin/candidates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, status, failure }),
  });
  const payload = (await response.json()) as { message?: string; candidate?: Candidate };

  if (!response.ok) {
    throw new Error(payload.message ?? "Could not update invite status.");
  }

  return payload.candidate ?? null;
}

export function createViolation(sectionSlug: string, reason: string) {
  const section =
    readActiveAssessmentSections().find((item) => item.slug === sectionSlug) ??
    assessmentSections.find((item) => item.slug === sectionSlug);
  const violation: AssessmentViolation = {
    id: createId("violation"),
    sectionSlug,
    sectionTitle: section?.title ?? sectionSlug,
    reason,
    occurredAt: new Date().toISOString(),
  };
  const violations = [...readAssessmentViolations(), violation];

  writeAssessmentViolations(violations);
  return violations;
}

export function clearAssessmentViolations() {
  writeAssessmentViolations([]);
}

function clearCandidateAssessmentRuntime(sections: AssessmentSection[]) {
  clearBrowserStorageByPrefix("kgm-hiring-assessment-");
  window.localStorage.removeItem(QUESTION_STATUS_STORAGE_KEY);

  sections.forEach((section) => {
    const sectionTimerKey = `kgm-hiring-assessment-timer-${section.slug}`;
    window.localStorage.removeItem(sectionTimerKey);
    window.sessionStorage.removeItem(sectionTimerKey);

    section.questions.forEach((question) => {
      const questionTimerKey = `kgm-hiring-assessment-question-timer-${section.slug}-${question.id}`;
      window.localStorage.removeItem(questionTimerKey);
      window.sessionStorage.removeItem(questionTimerKey);
      window.localStorage.removeItem(`${questionTimerKey}-remaining`);
      window.sessionStorage.removeItem(`${questionTimerKey}-remaining`);
    });
  });
}

function clearCandidateBrowserData() {
  clearBrowserStorageByPrefix("kgm-hiring-candidate-");
  window.localStorage.removeItem(JOBS_STORAGE_KEY);
  window.localStorage.removeItem(CANDIDATES_STORAGE_KEY);
  window.localStorage.removeItem(RESULTS_STORAGE_KEY);
  window.localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  window.localStorage.removeItem(VIOLATIONS_STORAGE_KEY);
  window.localStorage.removeItem("kgm-hiring-authenticated");
  window.localStorage.removeItem("kgm-hiring-active-candidate-id");
  window.sessionStorage.removeItem("kgm-hiring-authenticated");
  window.sessionStorage.removeItem("kgm-hiring-active-candidate-id");
}

export async function saveAssessmentResult({
  answers,
  status,
}: {
  answers: AssessmentAnswers;
  status: AssessmentResult["status"];
}) {
  const jobs = readJobAssessments();
  const candidates = readCandidates();
  const sections = readActiveAssessmentSections();
  const totalQuestions = sections.reduce(
    (total, section) => total + section.questions.length,
    0,
  );
  const answeredCount = sections
    .flatMap((section) => section.questions.map((question) => question.id))
    .filter((id) => answers[id]?.trim()).length;
  const score = calculateAssessmentScore(sections, answers);
  const assessment = readActiveJobAssessment() ?? jobs[0];
  if (!assessment) {
    throw new Error("No active assessment is available for submission.");
  }
  const activeCandidateId =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("kgm-hiring-active-candidate-id");
  const candidate =
    candidates.find(
      (item) =>
        item.id === activeCandidateId &&
        (item.jobId === assessment.id || item.assessmentIds?.includes(assessment.id)),
    ) ??
    candidates.find((item) => item.jobId === assessment.id && !item.submittedAt) ?? {
    name: "Preview Candidate",
    email: "candidate@example.com",
  };
  if ("id" in candidate && isExpired(candidate.inviteExpiresAt)) {
    throw new Error("This assessment invitation has expired. You can no longer start, continue, or submit it.");
  }
  const submittedAt = new Date().toISOString();
  const result: AssessmentResult = {
    id: createId("result"),
    assessmentId: assessment.id,
    ...("id" in candidate ? { candidateId: candidate.id } : {}),
    assessmentTitle: assessment.title,
    candidateName: candidate.name,
    candidateEmail: candidate.email,
    submittedAt,
    answeredCount,
    totalQuestions,
    score,
    status,
    violations: readAssessmentViolations(),
    answers: { ...answers },
  };

  let savedResult = result;
  if ("id" in candidate) {
    const response = await fetch("/api/candidate/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId: candidate.id,
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        answers: result.answers,
        answeredCount,
        totalQuestions,
        score,
        status,
        violations: result.violations,
      }),
    });
    const payload = (await response.json()) as {
      message?: string;
      submission?: AssessmentResult;
    };

    if (!response.ok || !payload.submission) {
      throw new Error(payload.message ?? "Submission could not be saved.");
    }

    savedResult = payload.submission;
  }

  if ("id" in candidate) {
    const previousResults = readAssessmentResults();
    const nextResults = previousResults.some((item) => item.id === savedResult.id)
      ? previousResults.map((item) => (item.id === savedResult.id ? savedResult : item))
      : [savedResult, ...previousResults];
    writeJson(RESULTS_STORAGE_KEY, nextResults);
    writeJson(
      CANDIDATES_STORAGE_KEY,
      candidates.map((item) =>
        item.id === candidate.id
          ? { ...item, submittedAt }
          : item,
      ),
    );

  }
  clearAssessmentViolations();
  clearCandidateAssessmentRuntime(sections);
  clearCandidateBrowserData();
  window.dispatchEvent(new Event("kgm-hiring-assessment-answers-change"));
  return savedResult;
}

export function updateAssessmentReview(
  resultId: string,
  updates: {
    textScores?: Record<string, number>;
    decision?: AssessmentResult["decision"];
  },
) {
  const results = readAssessmentResults();
  const nextResults = results.map((result) => {
    if (result.id !== resultId) {
      return result;
    }

    if (result.evaluatedAt && updates.textScores) {
      return result;
    }

    const job = readJobAssessments().find((item) => item.id === result.assessmentId);
    const sections = job
      ? buildAssessmentSectionsFromResource({
          resourceId: job.resourceId,
          sectionCount: job.sectionCount,
          questionsPerSection: job.questionsPerSection,
          timePerSectionMinutes: job.timePerSectionMinutes,
          seed: job.id,
          sectionTypeConfigs: job.sectionTypeConfigs,
        })
      : readActiveAssessmentSections();
    const textScores = { ...(result.textScores ?? {}), ...(updates.textScores ?? {}) };

    return {
      ...result,
      ...updates,
      textScores,
      score: calculateAssessmentScore(sections, result.answers ?? {}, textScores),
      evaluatedAt: new Date().toISOString(),
    };
  });

  writeJson(RESULTS_STORAGE_KEY, nextResults);
  return nextResults.find((result) => result.id === resultId) ?? null;
}
