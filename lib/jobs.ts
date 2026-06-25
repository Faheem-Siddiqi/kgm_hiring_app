import "server-only";

import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";
import {
  JOB_EXPERIENCE_LEVELS,
  JOB_LOCATIONS,
  JOB_STATUSES,
  type JobAssessmentOption,
  type JobExperience,
  type JobListSummary,
  type JobLocation,
  type Pagination,
  type JobStatus,
  type PublicJob,
} from "@/lib/job-types";

export type JobDocument = {
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
  assessmentIds: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  reopenedAt?: Date;
};

type JobAggregateDocument = WithId<JobDocument> & {
  assessments?: Array<{
    _id: ObjectId;
    code: string;
    name: string;
    questionBankName?: string;
    questionBankId?: string;
  }>;
};

export class JobError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "JobError";
  }
}

let indexesReady: Promise<void> | null = null;

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueValues(values: string[], max = 50) {
  const seen = new Set<string>();

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

function assertOption<T extends readonly string[]>(
  value: string,
  allowed: T,
  label: string,
): T[number] {
  if (allowed.includes(value)) return value as T[number];
  throw new JobError(`${label} is not valid.`, 400);
}

function getQuestionBankLabel(questionBankId?: string) {
  return questionBankId
    ? questionBankId
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
        .join(" ")
    : "Assessment";
}

function toPublicAssessmentOption(
  assessment: NonNullable<JobAggregateDocument["assessments"]>[number],
): JobAssessmentOption {
  return {
    id: assessment._id.toString(),
    code: assessment.code,
    name: assessment.name,
    questionBankName:
      assessment.questionBankName ?? getQuestionBankLabel(assessment.questionBankId),
    questionBankId: assessment.questionBankId ?? "",
    tags: [
      assessment.code,
      assessment.name,
      assessment.questionBankName ?? getQuestionBankLabel(assessment.questionBankId),
    ],
  };
}

function toPublicJob(job: JobAggregateDocument): PublicJob {
  const assessments = (job.assessments ?? []).map(toPublicAssessmentOption);

  return {
    id: job._id.toString(),
    slug: job.slug,
    title: job.title,
    department: job.department,
    location: job.location,
    experience: job.experience,
    status: job.status,
    summary: job.summary,
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    tags: job.tags,
    assessmentIds: (job.assessmentIds ?? []).map((id) => id.toString()),
    assessments,
    assessmentResourceId: assessments[0]?.id,
    assessmentResourceLabel: assessments[0]?.name,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    ...(job.reopenedAt ? { reopenedAt: job.reopenedAt.toISOString() } : {}),
  };
}

async function ensureJobIndexes(database: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      database.collection<JobDocument>("jobs").createIndex({ slug: 1 }, { unique: true }),
      database.collection<JobDocument>("jobs").createIndex({ status: 1, updatedAt: -1 }),
      database.collection<JobDocument>("jobs").createIndex({ assessmentIds: 1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesReady = null;
        throw error;
      });
  }

  return indexesReady;
}

async function getJobCollection(): Promise<Collection<JobDocument>> {
  const database = await getDatabase();
  await ensureJobIndexes(database);
  return database.collection<JobDocument>("jobs");
}

export function parseJobInput(input: {
  title?: string;
  department?: string;
  location?: string;
  experience?: string;
  status?: string;
  summary?: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  tags?: string[];
  assessmentIds?: unknown;
}) {
  const title = input.title?.trim() ?? "";
  const department = input.department?.trim() ?? "";
  const description = input.description?.trim() || input.summary?.trim() || "";
  const summary = input.summary?.trim() || description;
  const responsibilities = uniqueValues(input.responsibilities ?? []);
  const requirements = uniqueValues(input.requirements ?? []);
  const tags = uniqueValues(input.tags ?? [], 10);

  if (!title || !department || !description) {
    throw new JobError("Title, department, and description are required.", 400);
  }

  if (!responsibilities.length || !requirements.length) {
    throw new JobError("At least one responsibility and one requirement are required.", 400);
  }

  const assessmentIds = sanitizeAssessmentIds(input.assessmentIds);

  if (!assessmentIds.length) {
    throw new JobError("Select at least one assessment for this job.", 400);
  }

  return {
    title,
    department,
    location: assertOption(input.location ?? "", JOB_LOCATIONS, "Location"),
    experience: assertOption(input.experience ?? "", JOB_EXPERIENCE_LEVELS, "Experience"),
    status: assertOption(input.status ?? "open", JOB_STATUSES, "Job status"),
    summary,
    description,
    responsibilities,
    requirements,
    tags,
    assessmentIds,
  };
}

function sanitizeAssessmentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  ).map((item) => {
    if (!ObjectId.isValid(item)) {
      throw new JobError("Assessment is not valid.", 400);
    }
    return new ObjectId(item);
  });
}

async function assertAssessmentsExist(assessmentIds: ObjectId[]) {
  if (!assessmentIds.length) return;

  const database = await getDatabase();
  const count = await database
    .collection("assessments")
    .countDocuments({ _id: { $in: assessmentIds } });

  if (count !== assessmentIds.length) {
    throw new JobError("One or more selected assessments no longer exist.", 400);
  }
}

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parsePageSize(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), 50);
}

export function parsePaginationParams(searchParams: URLSearchParams) {
  return {
    page: parsePage(searchParams.get("page"), 1),
    pageSize: parsePageSize(searchParams.get("pageSize"), 10),
  };
}

export async function listJobs(
  options: { includeInactive?: boolean; page?: number; pageSize?: number } = {},
) {
  const jobs = await getJobCollection();
  const page = parsePage(options.page, 1);
  const pageSize = parsePageSize(options.pageSize, 10);
  const skip = (page - 1) * pageSize;
  const match = options.includeInactive
    ? {}
    : { status: { $in: ["open", "reopened"] } };
  const pipeline = [
    { $match: match },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    {
      $lookup: {
        from: "assessments",
        localField: "assessmentIds",
        foreignField: "_id",
        as: "assessments",
      },
    },
    {
      $facet: {
        jobs: [{ $skip: skip }, { $limit: pageSize }],
        statusCounts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        total: [{ $count: "count" }],
      },
    },
  ];
  const [result] = await jobs.aggregate<{
    jobs: JobAggregateDocument[];
    statusCounts: Array<{ _id: JobStatus; count: number }>;
    total: Array<{ count: number }>;
  }>(pipeline).toArray();
  const summary = {
    total: result?.total[0]?.count ?? 0,
    open: 0,
    paused: 0,
    closed: 0,
    reopened: 0,
  } satisfies JobListSummary;
  const total = result?.total[0]?.count ?? 0;
  const pagination = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  } satisfies Pagination;

  for (const item of result?.statusCounts ?? []) {
    summary[item._id] = item.count;
  }

  return {
    jobs: (result?.jobs ?? []).map(toPublicJob),
    summary,
    pagination,
  };
}

export async function getJobBySlug(slug: string, options: { includeInactive?: boolean } = {}) {
  const jobs = await getJobCollection();
  const [job] = await jobs
    .aggregate<JobAggregateDocument>([
      {
        $match: {
          slug,
          ...(options.includeInactive ? {} : { status: { $in: ["open", "reopened"] } }),
        },
      },
      {
        $lookup: {
          from: "assessments",
          localField: "assessmentIds",
          foreignField: "_id",
          as: "assessments",
        },
      },
      { $limit: 1 },
    ])
    .toArray();

  return job ? toPublicJob(job) : null;
}

export async function createJob(input: ReturnType<typeof parseJobInput>) {
  await assertAssessmentsExist(input.assessmentIds);
  const jobs = await getJobCollection();
  const now = new Date();
  const baseSlug = normalizeSlug(input.title);
  let slug = baseSlug || `job-${Date.now()}`;
  let counter = 2;

  while (await jobs.findOne({ slug }, { projection: { _id: 1 } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  await jobs.insertOne({
    ...input,
    slug,
    createdAt: now,
    updatedAt: now,
    ...(input.status === "reopened" ? { reopenedAt: now } : {}),
  });
  const job = await getJobBySlug(slug, { includeInactive: true });

  if (!job) throw new JobError("Job was created but could not be loaded.", 500);
  return job;
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  const jobs = await getJobCollection();
  const objectId = new ObjectId(jobId);
  const now = new Date();
  const update =
    status === "reopened"
      ? { $set: { status, reopenedAt: now, updatedAt: now } }
      : { $set: { status, updatedAt: now }, $unset: { reopenedAt: "" as const } };

  await jobs.updateOne({ _id: objectId }, update);
  const job = await jobs.findOne({ _id: objectId }, { projection: { slug: 1 } });

  if (!job) throw new JobError("Job was not found.", 404);
  const publicJob = await getJobBySlug(job.slug, { includeInactive: true });
  if (!publicJob) throw new JobError("Job was not found.", 404);
  return publicJob;
}

export async function updateJob(jobId: string, input: ReturnType<typeof parseJobInput>) {
  await assertAssessmentsExist(input.assessmentIds);
  const jobs = await getJobCollection();
  const objectId = new ObjectId(jobId);
  const now = new Date();
  const existing = await jobs.findOne({ _id: objectId }, { projection: { slug: 1 } });

  if (!existing) {
    throw new JobError("Job was not found.", 404);
  }

  await jobs.updateOne(
    { _id: objectId },
    input.status === "reopened"
      ? { $set: { ...input, updatedAt: now, reopenedAt: now } }
      : { $set: { ...input, updatedAt: now }, $unset: { reopenedAt: "" as const } },
  );

  const publicJob = await getJobBySlug(existing.slug, { includeInactive: true });
  if (!publicJob) throw new JobError("Job was not found.", 404);
  return publicJob;
}
