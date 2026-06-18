"use client";

import { assessmentSections } from "@/features/test/assessment-data";
import type { AssessmentAnswers } from "@/features/test/assessment-storage";

export type Candidate = {
  id: string;
  name: string;
  email: string;
  jobId: string;
  invitedAt: string;
};

export type JobAssessment = {
  id: string;
  title: string;
  role: string;
  createdAt: string;
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
};

const JOBS_STORAGE_KEY = "kgm-hiring-admin-jobs";
const CANDIDATES_STORAGE_KEY = "kgm-hiring-admin-candidates";
const RESULTS_STORAGE_KEY = "kgm-hiring-admin-results";
export const VIOLATIONS_STORAGE_KEY = "kgm-hiring-assessment-violations";

const defaultJobs: JobAssessment[] = [
  {
    id: "assistant-admin-officer",
    title: "Assistant Admin Officer Assessment",
    role: "Assistant Admin Officer",
    createdAt: "2026-06-18T00:00:00.000Z",
  },
];

const defaultCandidates: Candidate[] = [
  {
    id: "candidate-aisha",
    name: "Aisha Khan",
    email: "aisha.khan@example.com",
    jobId: "assistant-admin-officer",
    invitedAt: "2026-06-18T00:00:00.000Z",
  },
  {
    id: "candidate-bilal",
    name: "Bilal Ahmed",
    email: "bilal.ahmed@example.com",
    jobId: "assistant-admin-officer",
    invitedAt: "2026-06-18T00:00:00.000Z",
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  return readJson<JobAssessment[]>(JOBS_STORAGE_KEY, defaultJobs);
}

export function readCandidates() {
  return readJson<Candidate[]>(CANDIDATES_STORAGE_KEY, defaultCandidates);
}

export function readAssessmentResults() {
  return readJson<AssessmentResult[]>(RESULTS_STORAGE_KEY, []);
}

export function readAssessmentViolations() {
  return readJson<AssessmentViolation[]>(VIOLATIONS_STORAGE_KEY, []);
}

export function writeAssessmentViolations(violations: AssessmentViolation[]) {
  writeJson(VIOLATIONS_STORAGE_KEY, violations);
}

export function createJobAssessment(title: string, role: string) {
  const job: JobAssessment = {
    id: createId("job"),
    title,
    role,
    createdAt: new Date().toISOString(),
  };

  writeJson(JOBS_STORAGE_KEY, [job, ...readJobAssessments()]);
  return job;
}

export function createCandidate(name: string, email: string, jobId: string) {
  const candidate: Candidate = {
    id: createId("candidate"),
    name,
    email,
    jobId,
    invitedAt: new Date().toISOString(),
  };

  writeJson(CANDIDATES_STORAGE_KEY, [candidate, ...readCandidates()]);
  return candidate;
}

export function createViolation(sectionSlug: string, reason: string) {
  const section = assessmentSections.find((item) => item.slug === sectionSlug);
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
  const totalQuestions = assessmentSections.reduce(
    (total, section) => total + section.questions.length,
    0,
  );
  const answeredCount = assessmentSections
    .flatMap((section) => section.questions.map((question) => question.id))
    .filter((id) => answers[id]?.trim()).length;
  const score = totalQuestions
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;
  const assessment = jobs[0] ?? defaultJobs[0];
  const candidate = candidates[0] ?? {
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
  };

  writeJson(RESULTS_STORAGE_KEY, [result, ...readAssessmentResults()]);
  clearAssessmentViolations();
  return result;
}
