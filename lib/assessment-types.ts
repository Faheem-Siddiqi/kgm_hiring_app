export type AssessmentQuestionType = "mcq" | "multi" | "text";

export type AssessmentTypeSetting = {
  quantity: number;
  timeLimitSeconds: number;
};

export type AssessmentSectionSetting = {
  sectionId: string;
  sectionTitle: string;
  types: Record<AssessmentQuestionType, AssessmentTypeSetting>;
};

export type PublicAssessment = {
  id: string;
  code: string;
  name: string;
  description: string;
  questionBankId: string;
  questionBankName: string;
  sectionCount: number;
  totalQuestions: number;
  sectionSettings: AssessmentSectionSetting[];
  assignedJobIds: string[];
  assignedJobs: Array<{
    id: string;
    title: string;
    slug: string;
    department: string;
    location: string;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentListSummary = {
  total: number;
  assigned: number;
  unassigned: number;
};
