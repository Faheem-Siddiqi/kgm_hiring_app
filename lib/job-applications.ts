import "server-only";

import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";
import { getJobById } from "@/lib/jobs";
import { AppError } from "@/lib/server-error";

export type CandidateApplicationEmailStatus = "pending" | "sent" | "failed";
export type CandidateApplicationDecisionStatus = "pending" | "invited" | "rejected";

export type CandidateApplicationDecisionActor = {
  name: string;
  email: string;
};

type CandidateApplicationDocument = {
  jobId: ObjectId;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  cvUrl: string;
  availability: string;
  emailStatus: CandidateApplicationEmailStatus;
  emailFailure?: string;
  decisionStatus: CandidateApplicationDecisionStatus;
  decisionEmailStatus?: CandidateApplicationEmailStatus;
  decisionEmailFailure?: string;
  decidedBy?: CandidateApplicationDecisionActor;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicCandidateApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  cvUrl: string;
  availability: string;
  emailStatus: CandidateApplicationEmailStatus;
  emailFailure?: string;
  decisionStatus: CandidateApplicationDecisionStatus;
  decisionEmailStatus?: CandidateApplicationEmailStatus;
  decisionEmailFailure?: string;
  decidedBy?: CandidateApplicationDecisionActor;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export class CandidateApplicationError extends AppError {
  constructor(
    message: string,
    status = 400,
  ) {
    super(message, {
      status,
      code: "CANDIDATE_APPLICATION_ERROR",
      source: "VALIDATION",
    });
    this.name = "CandidateApplicationError";
  }
}

let indexesReady: Promise<void> | null = null;
const APPLICATION_REPEAT_WINDOW_MONTHS = 6;

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatApplicationDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(value);
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function assertValidUrl(value: string) {
  try {
    const url = new URL(normalizeUrl(value));
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new CandidateApplicationError("Enter a valid CV drive link.", 400);
  }
}

function assertValidEmail(value: string) {
  const email = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CandidateApplicationError("Enter a valid candidate email.", 400);
  }

  return email;
}

function toPublicApplication(
  application: WithId<CandidateApplicationDocument>,
): PublicCandidateApplication {
  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    jobTitle: application.jobTitle,
    candidateName: application.candidateName,
    candidateEmail: application.candidateEmail,
    cvUrl: application.cvUrl,
    availability: application.availability,
    emailStatus: application.emailStatus,
    emailFailure: application.emailFailure,
    decisionStatus: application.decisionStatus ?? "pending",
    decisionEmailStatus: application.decisionEmailStatus,
    decisionEmailFailure: application.decisionEmailFailure,
    decidedBy: application.decidedBy,
    decidedAt: application.decidedAt?.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

async function ensureCandidateApplicationIndexes(database: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      database
        .collection<CandidateApplicationDocument>("candidate_applications")
        .createIndex({ createdAt: -1 }),
      database
        .collection<CandidateApplicationDocument>("candidate_applications")
        .createIndex({ jobId: 1, createdAt: -1 }),
      database
        .collection<CandidateApplicationDocument>("candidate_applications")
        .createIndex({ candidateEmail: 1, jobId: 1, createdAt: -1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesReady = null;
        throw error;
      });
  }

  return indexesReady;
}

async function getCandidateApplicationCollection(): Promise<
  Collection<CandidateApplicationDocument>
> {
  const database = await getDatabase();
  await ensureCandidateApplicationIndexes(database);
  return database.collection<CandidateApplicationDocument>("candidate_applications");
}

export async function createCandidateApplication(input: {
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  cvUrl: string;
  availability: string;
}) {
  const candidateName = input.candidateName.trim();
  const candidateEmail = assertValidEmail(input.candidateEmail);
  const availability = input.availability.trim();

  if (!ObjectId.isValid(input.jobId)) {
    throw new CandidateApplicationError("Job is not valid.", 400);
  }

  if (!candidateName || !candidateEmail || !availability || !input.cvUrl.trim()) {
    throw new CandidateApplicationError(
      "Candidate name, email, CV link, and availability are required.",
      400,
    );
  }

  const job = await getJobById(input.jobId, { includeInactive: true });
  if (!job) {
    throw new CandidateApplicationError("This job is not accepting applications.", 404);
  }

  if (job.status === "paused" || job.status === "closed") {
    throw new CandidateApplicationError(
      "This role is not accepting new applications right now.",
      409,
    );
  }

  const now = new Date();
  const applications = await getCandidateApplicationCollection();
  const repeatWindowStart = addMonths(now, -APPLICATION_REPEAT_WINDOW_MONTHS);
  const recentApplication = await applications.findOne(
    {
      jobId: new ObjectId(job.id),
      candidateEmail,
      createdAt: { $gte: repeatWindowStart },
    },
    { sort: { createdAt: -1 }, projection: { createdAt: 1 } },
  );

  if (recentApplication) {
    const nextEligibleDate = addMonths(
      recentApplication.createdAt,
      APPLICATION_REPEAT_WINDOW_MONTHS,
    );

    throw new CandidateApplicationError(
      `You have already applied for this position. You can submit a new application after ${formatApplicationDate(nextEligibleDate)}, which is 6 months from your previous application.`,
      409,
    );
  }

  const result = await applications.insertOne({
    jobId: new ObjectId(job.id),
    jobTitle: job.title,
    candidateName,
    candidateEmail,
    cvUrl: assertValidUrl(input.cvUrl),
    availability,
    emailStatus: "pending",
    decisionStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });
  const application = await applications.findOne({ _id: result.insertedId });

  if (!application) {
    throw new CandidateApplicationError("Application was saved but could not be loaded.", 500);
  }

  return toPublicApplication(application);
}

export async function updateCandidateApplicationDecision(
  applicationId: string,
  decisionStatus: Exclude<CandidateApplicationDecisionStatus, "pending">,
  emailStatus?: CandidateApplicationEmailStatus,
  failure?: string | null,
  decidedBy?: CandidateApplicationDecisionActor,
) {
  if (!ObjectId.isValid(applicationId)) return null;

  const applications = await getCandidateApplicationCollection();
  await applications.updateOne(
    { _id: new ObjectId(applicationId) },
    {
      $set: {
        decisionStatus,
        decidedAt: new Date(),
        updatedAt: new Date(),
        ...(emailStatus ? { decisionEmailStatus: emailStatus } : {}),
        ...(failure ? { decisionEmailFailure: failure } : {}),
        ...(decidedBy ? { decidedBy } : {}),
      },
      ...(failure ? {} : { $unset: { decisionEmailFailure: "" as const } }),
    },
  );
  const application = await applications.findOne({ _id: new ObjectId(applicationId) });
  return application ? toPublicApplication(application) : null;
}

export async function updateCandidateApplicationEmailStatus(
  applicationId: string,
  status: CandidateApplicationEmailStatus,
  failure?: string | null,
) {
  if (!ObjectId.isValid(applicationId)) return null;

  const applications = await getCandidateApplicationCollection();
  await applications.updateOne(
    { _id: new ObjectId(applicationId) },
    {
      $set: {
        emailStatus: status,
        updatedAt: new Date(),
        ...(failure ? { emailFailure: failure } : {}),
      },
      ...(failure ? {} : { $unset: { emailFailure: "" as const } }),
    },
  );
  const application = await applications.findOne({ _id: new ObjectId(applicationId) });
  return application ? toPublicApplication(application) : null;
}

export async function getCandidateApplicationById(applicationId: string) {
  if (!ObjectId.isValid(applicationId)) return null;

  const applications = await getCandidateApplicationCollection();
  const application = await applications.findOne({ _id: new ObjectId(applicationId) });
  return application ? toPublicApplication(application) : null;
}

export async function listCandidateApplications() {
  const applications = await getCandidateApplicationCollection();
  const records = await applications
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return records.map(toPublicApplication);
}
