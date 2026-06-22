import adminOfficer from "@/features/test/resources/admin-officer.json";
import assistantHrOfficer from "@/features/test/resources/assistant-hr-officer.json";
import assistantManager from "@/features/test/resources/assistant-manager.json";
import type { AssessmentSection, Question } from "@/features/test/assessment-data";

type ResourceOpenQuestion = string;

type ResourceChoiceQuestion = {
  q: string;
  o: string[];
  a: number[];
  min?: number;
  max?: number;
};

type ResourceSection = {
  id: string;
  title: string;
  open?: ResourceOpenQuestion[];
  single?: ResourceChoiceQuestion[];
  multi?: ResourceChoiceQuestion[];
};

export type AssessmentResource = {
  v: number;
  id: string;
  role: string;
  sections: ResourceSection[];
};

export type AssessmentResourceSummary = {
  id: string;
  role: string;
  sectionCount: number;
  maxQuestionsPerSection: number;
  sections: Array<{
    id: string;
    title: string;
    counts: Record<"mcq" | "multi" | "text", number>;
  }>;
};

export const assessmentResources = [
  adminOfficer,
  assistantHrOfficer,
  assistantManager,
] as AssessmentResource[];

export const assessmentResourceSummaries: AssessmentResourceSummary[] =
  assessmentResources.map((resource) => ({
    id: resource.id,
    role: resource.role,
    sectionCount: resource.sections.length,
    maxQuestionsPerSection: Math.min(
      ...resource.sections.map((section) => getSectionQuestionCount(section)),
    ),
    sections: resource.sections.map((section) => ({
      id: section.id,
      title: section.title,
      counts: {
        mcq: section.single?.length ?? 0,
        multi: section.multi?.length ?? 0,
        text: section.open?.length ?? 0,
      },
    })),
  }));

function getSectionQuestionCount(section: ResourceSection) {
  return (
    (section.open?.length ?? 0) +
    (section.single?.length ?? 0) +
    (section.multi?.length ?? 0)
  );
}

function shuffleWithSeed<T>(items: T[], seed: string) {
  const next = [...items];
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  for (let index = next.length - 1; index > 0; index -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const swapIndex = hash % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function toQuestions(section: ResourceSection, seed: string) {
  const openQuestions: Question[] = (section.open ?? []).map((prompt, index) => ({
    id: `${section.id}-open-${index + 1}`,
    prompt,
    type: "text",
  }));
  const singleQuestions: Question[] = (section.single ?? []).map(
    (question, index) => ({
      id: `${section.id}-single-${index + 1}`,
      prompt: question.q,
      type: "mcq",
      options: question.o,
      correctAnswers: question.a.map((answerIndex) => question.o[answerIndex]),
    }),
  );
  const multiQuestions: Question[] = (section.multi ?? []).map(
    (question, index) => ({
      id: `${section.id}-multi-${index + 1}`,
      prompt: question.q,
      type: "multi",
      options: question.o,
      minSelections: question.min ?? question.a.length,
      maxSelections: question.max ?? question.a.length,
      correctAnswers: question.a.map((answerIndex) => question.o[answerIndex]),
    }),
  );

  return shuffleWithSeed(
    [...openQuestions, ...singleQuestions, ...multiQuestions],
    seed,
  );
}

export function getAssessmentResource(resourceId: string) {
  return (
    assessmentResources.find((resource) => resource.id === resourceId) ??
    assessmentResources[0]
  );
}

export function buildAssessmentSectionsFromResource({
  resourceId,
  sectionCount,
  questionsPerSection,
  timePerSectionMinutes,
  seed,
  sectionTypeConfigs,
}: {
  resourceId: string;
  sectionCount: number;
  questionsPerSection: number;
  timePerSectionMinutes: number;
  seed: string;
  sectionTypeConfigs?: Record<string, SectionQuestionTypeConfig>;
}): AssessmentSection[] {
  const resource = getAssessmentResource(resourceId);
  const selectedSections = resource.sections.slice(
    0,
    Math.min(sectionCount, resource.sections.length),
  );

  return selectedSections.map((section) => {
    const availableQuestions = toQuestions(section, `${seed}-${section.id}`);
    const config = sectionTypeConfigs?.[section.id];
    const questions = config
      ? (["mcq", "multi", "text"] as const).flatMap((type) =>
          availableQuestions
            .filter((question) => question.type === type)
            .slice(0, config[type].quantity)
            .map((question) => ({
              ...question,
              timeLimitSeconds: config[type].timeLimitSeconds,
            })),
        )
      : availableQuestions.slice(0, questionsPerSection);
    const questionTimeSeconds = Math.max(
      1,
      Math.floor((timePerSectionMinutes * 60) / Math.max(questions.length, 1)),
    );

    return {
      slug: section.id,
      title: section.title,
      time: `${timePerSectionMinutes} min`,
      questionTimeSeconds,
      questions,
    };
  });
}

export type SectionQuestionTypeConfig = Record<
  "mcq" | "multi" | "text",
  { quantity: number; timeLimitSeconds: number }
>;
