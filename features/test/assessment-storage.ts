import { assessmentSections } from "@/features/test/assessment-data";

export type AssessmentAnswers = Record<string, string>;

export const ANSWERS_STORAGE_KEY = "kgm-hiring-assessment-answers";

export function readStoredAnswers(): AssessmentAnswers {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawAnswers = window.localStorage.getItem(ANSWERS_STORAGE_KEY);
    return rawAnswers ? (JSON.parse(rawAnswers) as AssessmentAnswers) : {};
  } catch {
    return {};
  }
}

export function readStoredAnswersSnapshot() {
  if (typeof window === "undefined") {
    return "{}";
  }

  return window.localStorage.getItem(ANSWERS_STORAGE_KEY) ?? "{}";
}

export function writeStoredAnswers(answers: AssessmentAnswers) {
  window.localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(answers));
  window.dispatchEvent(new Event("kgm-hiring-assessment-answers-change"));
}

export function getAnsweredCount(answers: AssessmentAnswers, questionIds: string[]) {
  return questionIds.filter((id) => answers[id]?.trim()).length;
}

export function getTotalQuestionCount() {
  return assessmentSections.reduce(
    (total, section) => total + section.questions.length,
    0,
  );
}
