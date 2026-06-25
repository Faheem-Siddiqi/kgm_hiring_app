"use client";

import { assessmentSections } from "@/features/test/assessment-data";
import {
  assessmentResourceSummaries,
  buildAssessmentSectionsFromResource,
  getAssessmentResource,
} from "@/features/test/assessment-resources";
import type { AssessmentAnswers } from "@/features/test/assessment-storage";
import type { SectionQuestionTypeConfig } from "@/features/test/assessment-resources";

export type Candidate = {
  id: string;
  name: string;
  email: string;
  jobId: string;
  otpCode: string;
  cvUrl: string;
  invitedAt: string;
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
};

const JOBS_STORAGE_KEY = "kgm-hiring-admin-jobs";
const CANDIDATES_STORAGE_KEY = "kgm-hiring-admin-candidates";
const RESULTS_STORAGE_KEY = "kgm-hiring-admin-results";
const ACTIVE_JOB_STORAGE_KEY = "kgm-hiring-active-assessment-id";
export const VIOLATIONS_STORAGE_KEY = "kgm-hiring-assessment-violations";

const defaultJobs: JobAssessment[] = [
  {
    id: "assistant-admin-officer",
    title: "Assistant Admin Officer Assessment",
    role: "Assistant Admin Officer",
    createdAt: "2026-06-18T00:00:00.000Z",
    resourceId: "admin-officer",
    sectionCount: 3,
    timePerSectionMinutes: 15,
    questionsPerTest: 20,
    questionsPerSection: 20,
    dummyQuestionsPerSection: 3,
  },
];

const defaultCandidates: Candidate[] = [
  {
    id: "candidate-aisha",
    name: "Aisha Khan",
    email: "aisha.khan@example.com",
    jobId: "assistant-admin-officer",
    otpCode: "482913",
    cvUrl: "https://drive.google.com/file/d/preview-aisha/view",
    invitedAt: "2026-06-18T00:00:00.000Z",
  },
  {
    id: "candidate-bilal",
    name: "Bilal Ahmed",
    email: "bilal.ahmed@example.com",
    jobId: "assistant-admin-officer",
    otpCode: "739204",
    cvUrl: "https://drive.google.com/file/d/preview-bilal/view",
    invitedAt: "2026-06-18T00:00:00.000Z",
  },
];

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

export function authenticateCandidate(otpCode: string) {
  const candidate = readCandidates().find(
    (item) => item.otpCode === otpCode.trim(),
  );

  if (candidate) {
    writeActiveJobAssessment(candidate.jobId);
    window.localStorage.setItem("kgm-hiring-active-candidate-id", candidate.id);
  }

  return candidate;
}

export function readAssessmentResults() {
  return readJson<AssessmentResult[]>(RESULTS_STORAGE_KEY, []);
}

export function readAssessmentViolations() {
  return readJson<AssessmentViolation[]>(VIOLATIONS_STORAGE_KEY, []);
}

export function readActiveJobAssessment() {
  const jobs = readJobAssessments();

  if (typeof window === "undefined") {
    return jobs[0] ?? defaultJobs[0];
  }

  const activeJobId = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);

  return jobs.find((job) => job.id === activeJobId) ?? jobs[0] ?? defaultJobs[0];
}

export function writeActiveJobAssessment(jobId: string) {
  window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
  window.dispatchEvent(new Event("kgm-hiring-admin-data-change"));
}

export function readActiveAssessmentSections() {
  const job = readActiveJobAssessment();

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
  };

  writeJson(CANDIDATES_STORAGE_KEY, [candidate, ...readCandidates()]);
  writeActiveJobAssessment(jobId);
  return candidate;
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

export function saveAssessmentResult({
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
  const objectiveQuestions = sections
    .flatMap((section) => section.questions)
    .filter((question) => question.type !== "text");
  const earnedPoints = objectiveQuestions.reduce((total, question) => {
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
  const score = objectiveQuestions.length
    ? Math.round((earnedPoints / objectiveQuestions.length) * 100)
    : 0;
  const assessment = readActiveJobAssessment() ?? jobs[0] ?? defaultJobs[0];
  const candidate = candidates.find((item) => item.jobId === assessment.id) ?? {
    name: "Preview Candidate",
    email: "candidate@example.com",
  };
  const result: AssessmentResult = {
    id: createId("result"),
    assessmentId: assessment.id,
    assessmentTitle: assessment.title,
    candidateName: candidate.name,
    candidateEmail: candidate.email,
    submittedAt: new Date().toISOString(),
    answeredCount,
    totalQuestions,
    score,
    status,
    violations: readAssessmentViolations(),
    answers: { ...answers },
  };

  writeJson(RESULTS_STORAGE_KEY, [result, ...readAssessmentResults()]);
  clearAssessmentViolations();
  return result;
}
