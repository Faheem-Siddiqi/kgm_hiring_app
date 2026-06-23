import "server-only";

import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";
import { assessmentResourceSummaries } from "@/features/test/assessment-resources";
import {
  JOB_EXPERIENCE_LEVELS,
  JOB_LOCATIONS,
  JOB_STATUSES,
  type JobAssessmentResourceOption,
  type JobExperience,
  type JobListSummary,
  type JobLocation,
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
  assessmentResourceId: string;
  createdAt: Date;
  updatedAt: Date;
  reopenedAt?: Date;
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

const dummyJobs: Array<Omit<JobDocument, "createdAt" | "updatedAt">> = [
  {
    slug: "finance-officer",
    title: "Finance Officer",
    department: "Finance",
    location: "KGM OnSite",
    experience: "Mid Level",
    status: "open",
    summary:
      "Support monthly reporting, reconciliations, vendor payments, and audit-ready documentation for KGM operations.",
    description:
      "This role is designed for a detail-oriented finance professional who can keep daily records accurate while supporting leadership with timely reporting.",
    responsibilities: [
      "Prepare reconciliations and support month-end closing activities.",
      "Review invoices, payments, and supporting documents before approval.",
      "Coordinate with operations teams on expense records and reporting needs.",
      "Maintain audit-friendly files and flag gaps early.",
    ],
    requirements: [
      "Bachelor's degree in Finance, Accounting, or a related field.",
      "Relevant finance or accounts experience.",
      "Comfort with Excel, reconciliations, and documentation control.",
    ],
    tags: ["Accounts", "Excel", "Reporting"],
    assessmentResourceId: "assistant-manager",
  },
  {
    slug: "assistant-hr-officer",
    title: "Assistant HR Officer",
    department: "Human Resources",
    location: "KTM OnSite",
    experience: "Fresh",
    status: "open",
    summary:
      "Assist with onboarding, employee records, attendance coordination, and recruitment documentation.",
    description:
      "The Assistant HR Officer supports day-to-day HR operations with clean records, responsive communication, and consistent follow-through.",
    responsibilities: [
      "Maintain employee files, onboarding checklists, and HR trackers.",
      "Support interview scheduling and candidate communication.",
      "Coordinate attendance and leave documentation with department leads.",
      "Prepare simple HR summaries for review.",
    ],
    requirements: [
      "Bachelor's degree in HR, Business Administration, or related discipline.",
      "Strong written communication and documentation habits.",
      "Ability to handle confidential employee information responsibly.",
    ],
    tags: ["HR", "Records", "Onboarding"],
    assessmentResourceId: "assistant-hr-officer",
  },
  {
    slug: "admin-officer",
    title: "Admin Officer",
    department: "Administration",
    location: "KGM Remote",
    experience: "Experienced",
    status: "paused",
    summary:
      "Manage office coordination, vendor follow-ups, facility requests, and administrative reporting.",
    description:
      "This position keeps administrative work moving smoothly across teams with organized follow-up and clear reporting.",
    responsibilities: [
      "Track office requests and coordinate timely resolution.",
      "Work with vendors on supplies, services, and documentation.",
      "Prepare administrative summaries and maintain records.",
      "Support internal teams with day-to-day coordination.",
    ],
    requirements: [
      "Administration or operations coordination experience.",
      "Good follow-up discipline and written communication skills.",
      "Comfort managing multiple small tasks without losing detail.",
    ],
    tags: ["Admin", "Coordination", "Vendors"],
    assessmentResourceId: "admin-officer",
  },
];

let indexesReady: Promise<void> | null = null;
let seedsReady: Promise<void> | null = null;

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

function formatResourceLabel(resourceId: string) {
  return resourceId
    .replace(/\.json$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function getJobAssessmentResourceOptions(): JobAssessmentResourceOption[] {
  return assessmentResourceSummaries.map((resource) => ({
    id: resource.id,
    label: formatResourceLabel(resource.id),
  }));
}

function assertAssessmentResourceId(value: string) {
  const options = getJobAssessmentResourceOptions();

  if (options.some((option) => option.id === value)) {
    return value;
  }

  throw new JobError("Assessment resource is not valid.", 400);
}

function assertOption<T extends readonly string[]>(
  value: string,
  allowed: T,
  label: string,
): T[number] {
  if (allowed.includes(value)) return value as T[number];
  throw new JobError(`${label} is not valid.`, 400);
}

function toPublicJob(job: WithId<JobDocument>): PublicJob {
  const assessmentResourceId = job.assessmentResourceId ?? "admin-officer";

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
    assessmentResourceId,
    assessmentResourceLabel: formatResourceLabel(assessmentResourceId),
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

async function seedJobs() {
  const jobs = await getJobCollection();
  const now = new Date();

  await jobs.bulkWrite(
    dummyJobs.map((job) => ({
      updateOne: {
        filter: { slug: job.slug },
        update: {
          $setOnInsert: {
            ...job,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })),
  );
}

async function ensureJobSeeds() {
  if (!seedsReady) {
    seedsReady = seedJobs().catch((error) => {
      seedsReady = null;
      throw error;
    });
  }

  return seedsReady;
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
  assessmentResourceId?: string;
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
    assessmentResourceId: assertAssessmentResourceId(input.assessmentResourceId ?? ""),
  };
}

export async function listJobs(options: { includeInactive?: boolean } = {}) {
  await ensureJobSeeds();
  const jobs = await getJobCollection();
  const match = options.includeInactive
    ? {}
    : { status: { $in: ["open", "reopened"] } };
  const pipeline = [
    { $match: match },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    {
      $facet: {
        jobs: [{ $limit: 100 }],
        statusCounts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        total: [{ $count: "count" }],
      },
    },
  ];
  const [result] = await jobs.aggregate<{
    jobs: WithId<JobDocument>[];
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

  for (const item of result?.statusCounts ?? []) {
    summary[item._id] = item.count;
  }

  return {
    jobs: (result?.jobs ?? []).map(toPublicJob),
    summary,
  };
}

export async function getJobBySlug(slug: string, options: { includeInactive?: boolean } = {}) {
  await ensureJobSeeds();
  const jobs = await getJobCollection();
  const job = await jobs.findOne({
    slug,
    ...(options.includeInactive ? {} : { status: { $in: ["open", "reopened"] } }),
  });

  return job ? toPublicJob(job) : null;
}

export async function createJob(input: ReturnType<typeof parseJobInput>) {
  await ensureJobSeeds();
  const jobs = await getJobCollection();
  const now = new Date();
  const baseSlug = normalizeSlug(input.title);
  let slug = baseSlug || `job-${Date.now()}`;
  let counter = 2;

  while (await jobs.findOne({ slug }, { projection: { _id: 1 } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  const result = await jobs.insertOne({
    ...input,
    slug,
    createdAt: now,
    updatedAt: now,
    ...(input.status === "reopened" ? { reopenedAt: now } : {}),
  });
  const job = await jobs.findOne({ _id: result.insertedId });

  if (!job) throw new JobError("Job was created but could not be loaded.", 500);
  return toPublicJob(job);
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  await ensureJobSeeds();
  const jobs = await getJobCollection();
  const objectId = new ObjectId(jobId);
  const now = new Date();
  const update =
    status === "reopened"
      ? { $set: { status, reopenedAt: now, updatedAt: now } }
      : { $set: { status, updatedAt: now }, $unset: { reopenedAt: "" as const } };

  await jobs.updateOne({ _id: objectId }, update);
  const job = await jobs.findOne({ _id: objectId });

  if (!job) throw new JobError("Job was not found.", 404);
  return toPublicJob(job);
}
