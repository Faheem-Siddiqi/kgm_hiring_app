export const JOB_LOCATIONS = [
  "KGM OnSite",
  "KTM OnSite",
  "KGM Remote",
  "KTM Remote",
] as const;

export const JOB_EXPERIENCE_LEVELS = [
  "Fresh",
  "Mid Level",
  "Experienced"
 
] as const;

export const JOB_STATUSES = ["open", "paused", "closed", "reopened"] as const;

export type JobLocation = (typeof JOB_LOCATIONS)[number];
export type JobExperience = (typeof JOB_EXPERIENCE_LEVELS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobAssessmentResourceOption = {
  id: string;
  label: string;
};

export type JobAssessmentOption = {
  id: string;
  code: string;
  name: string;
  questionBankName: string;
  questionBankId: string;
  tags: string[];
};

export type PublicJob = {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: JobLocation;
  experience: JobExperience;
  status: JobStatus;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  tags: string[];
  assessmentIds: string[];
  assessments: JobAssessmentOption[];
  assessmentResourceId?: string;
  assessmentResourceLabel?: string;
  createdAt: string;
  updatedAt: string;
  reopenedAt?: string;
};

export type JobListSummary = {
  total: number;
  open: number;
  paused: number;
  closed: number;
  reopened: number;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
