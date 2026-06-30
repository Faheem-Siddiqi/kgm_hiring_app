import "server-only";

import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";
import { getAssessmentById } from "@/lib/assessments";
import type { PublicAssessment } from "@/lib/assessment-types";
import { getJobById } from "@/lib/jobs";

export type AssessmentViolationRecord = {
  id: string;
  sectionSlug: string;
  sectionTitle: string;
  reason: string;
  occurredAt: Date;
};

export type SubmissionReviewRecord = {
  id: string;
  adminId: ObjectId;
  adminName: string;
  adminEmail: string;
  action: "evaluated" | "accepted" | "rejected" | "forwarded";
  createdAt: Date;
};

type CandidateDocument = {
  name: string;
  email: string;
  assessmentId: ObjectId;
  jobId?: ObjectId;
  jobTitle?: string;
  assessmentIds?: ObjectId[];
  otpCode: string;
  cvUrl: string;
  invitedAt: Date;
  inviteExpiresAt?: Date;
  inviteEmailStatus?: "pending" | "sent" | "failed";
  inviteEmailFailure?: string;
  submittedAt?: Date;
};

type SubmissionDocument = {
  assessmentId: ObjectId;
  assessmentTitle: string;
  candidateId: ObjectId;
  candidateName: string;
  candidateEmail: string;
  submittedAt: Date;
  answeredCount: number;
  totalQuestions: number;
  score: number;
  status: "Submitted" | "Auto submitted";
  violations: AssessmentViolationRecord[];
  answers: Record<string, string>;
  textScores?: Record<string, number>;
  reviews: SubmissionReviewRecord[];
  evaluatedAt?: Date;
  evaluatedBy?: {
    adminId: ObjectId;
    name: string;
    email: string;
  };
  decision?: "accepted" | "rejected" | "forwarded";
};

export type PublicCandidateRecord = {
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

export type PublicSubmissionReview = {
  id: string;
  adminName: string;
  adminEmail: string;
  action: "evaluated" | "accepted" | "rejected" | "forwarded";
  createdAt: string;
};

export type PublicSubmissionRecord = {
  id: string;
  assessmentId: string;
  candidateId: string;
  assessmentTitle: string;
  candidateName: string;
  candidateEmail: string;
  submittedAt: string;
  answeredCount: number;
  totalQuestions: number;
  score: number;
  status: "Submitted" | "Auto submitted";
  violations: Array<Omit<AssessmentViolationRecord, "occurredAt"> & { occurredAt: string }>;
  answers?: Record<string, string>;
  textScores?: Record<string, number>;
  evaluatedAt?: string;
  evaluatedBy?: {
    name: string;
    email: string;
  };
  decision?: "accepted" | "rejected" | "forwarded";
  reviews: PublicSubmissionReview[];
};

export type CreateAssessmentCandidateResult = {
  candidate: PublicCandidateRecord;
  assessment: PublicAssessment;
  assessments?: PublicAssessment[];
  existingPending: boolean;
};

let indexesReady: Promise<void> | null = null;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;

function createOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function defaultInviteExpiry(invitedAt = new Date()) {
  return new Date(invitedAt.getTime() + DEFAULT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

function parseInviteExpiry(value?: string) {
  if (!value) return defaultInviteExpiry();
  const trimmed = value.trim();
  if (!trimmed) return defaultInviteExpiry();

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.999`)
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invite expiry date is not valid.");
  }

  return parsed;
}

function getInviteExpiresAt(candidate: Pick<CandidateDocument, "inviteExpiresAt" | "invitedAt">) {
  return candidate.inviteExpiresAt ?? defaultInviteExpiry(candidate.invitedAt);
}

function isCandidateInviteExpired(candidate: Pick<CandidateDocument, "inviteExpiresAt" | "invitedAt">) {
  return getInviteExpiresAt(candidate).getTime() <= Date.now();
}

async function ensureIndexes(database: Db) {
  if (!indexesReady) {
    const submissions = database.collection<SubmissionDocument>("assessmentSubmissions");
    indexesReady = Promise.all([
      database.collection<CandidateDocument>("assessmentCandidates").createIndex(
        { otpCode: 1 },
        { unique: true },
      ),
      database
        .collection<CandidateDocument>("assessmentCandidates")
        .createIndex({ assessmentId: 1, invitedAt: -1 }),
      database
        .collection<CandidateDocument>("assessmentCandidates")
        .createIndex({ jobId: 1, invitedAt: -1 }),
      database
        .collection<CandidateDocument>("assessmentCandidates")
        .createIndex({ email: 1, jobId: 1, submittedAt: 1 }),
      database
        .collection<CandidateDocument>("assessmentCandidates")
        .createIndex({ inviteExpiresAt: 1, submittedAt: 1 }),
      database
        .collection<SubmissionDocument>("assessmentSubmissions")
        .createIndex({ assessmentId: 1, submittedAt: -1 }),
      submissions.dropIndex("candidateId_1").catch(() => undefined),
    ])
      .then(() => submissions.createIndex({ candidateId: 1, assessmentId: 1 }, { unique: true }))
      .then(() => undefined)
      .catch((error) => {
        indexesReady = null;
        throw error;
      });
  }

  return indexesReady;
}

async function getCollections() {
  const database = await getDatabase();
  await ensureIndexes(database);
  return {
    candidates: database.collection<CandidateDocument>("assessmentCandidates"),
    submissions: database.collection<SubmissionDocument>("assessmentSubmissions"),
  };
}

function toPublicCandidate(candidate: WithId<CandidateDocument>): PublicCandidateRecord {
  const inviteExpiresAt = getInviteExpiresAt(candidate);

  return {
    id: candidate._id.toString(),
    name: candidate.name,
    email: candidate.email,
    jobId: candidate.assessmentId.toString(),
    ...(candidate.jobId ? { jobAssignmentId: candidate.jobId.toString() } : {}),
    ...(candidate.jobTitle ? { jobTitle: candidate.jobTitle } : {}),
    ...(candidate.assessmentIds?.length
      ? { assessmentIds: candidate.assessmentIds.map((id) => id.toString()) }
      : {}),
    otpCode: candidate.otpCode,
    cvUrl: candidate.cvUrl,
    invitedAt: candidate.invitedAt.toISOString(),
    inviteExpiresAt: inviteExpiresAt.toISOString(),
    isInviteExpired: inviteExpiresAt.getTime() <= Date.now(),
    inviteEmailStatus: candidate.inviteEmailStatus,
    inviteEmailFailure: candidate.inviteEmailFailure,
    ...(candidate.submittedAt ? { submittedAt: candidate.submittedAt.toISOString() } : {}),
  };
}

function toPublicSubmission(submission: WithId<SubmissionDocument>): PublicSubmissionRecord {
  const evaluatedBy = submission.evaluatedBy
    ? {
        name: submission.evaluatedBy.name,
        email: submission.evaluatedBy.email,
      }
    : undefined;

  return {
    id: submission._id.toString(),
    assessmentId: submission.assessmentId.toString(),
    candidateId: submission.candidateId.toString(),
    assessmentTitle: submission.assessmentTitle,
    candidateName: submission.candidateName,
    candidateEmail: submission.candidateEmail,
    submittedAt: submission.submittedAt.toISOString(),
    answeredCount: submission.answeredCount,
    totalQuestions: submission.totalQuestions,
    score: submission.score,
    status: submission.status,
    violations: submission.violations.map((violation) => ({
      ...violation,
      occurredAt: violation.occurredAt.toISOString(),
    })),
    answers: submission.answers,
    textScores: submission.textScores,
    ...(submission.evaluatedAt ? { evaluatedAt: submission.evaluatedAt.toISOString() } : {}),
    evaluatedBy,
    decision: submission.decision,
    reviews: (submission.reviews ?? []).map((review) => ({
      id: review.id,
      adminName: review.adminName,
      adminEmail: review.adminEmail,
      action: review.action,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

export async function createAssessmentCandidate({
  name,
  email,
  assessmentId,
  jobId,
  inviteExpiresAt,
}: {
  name: string;
  email: string;
  assessmentId: string;
  jobId?: string;
  inviteExpiresAt?: string;
}) {
  if (!ObjectId.isValid(assessmentId) && (!jobId || !ObjectId.isValid(jobId))) {
    throw new Error("Assessment is not valid.");
  }

  if (jobId && ObjectId.isValid(jobId)) {
    const job = await getJobById(jobId, { includeInactive: true });
    if (!job) {
      throw new Error("Job was not found.");
    }
    if (!job.assessmentIds.length) {
      throw new Error("This job has no assessments assigned.");
    }

    const { candidates } = await getCollections();
    const normalizedEmail = email.trim().toLowerCase();
    const expiresAt = parseInviteExpiry(inviteExpiresAt);
    const existingAssignment = await candidates.findOne(
      {
        email: normalizedEmail,
        jobId: new ObjectId(job.id),
        submittedAt: { $exists: false },
      },
      { sort: { invitedAt: -1 } },
    );
    const assessments = await Promise.all(
      job.assessmentIds.map((id) => getAssessmentById(id)),
    );
    const validAssessments = assessments.filter(Boolean) as PublicAssessment[];

    if (existingAssignment) {
      const shouldRefreshExpiry =
        Boolean(inviteExpiresAt) || !existingAssignment.inviteExpiresAt;
      const candidate = shouldRefreshExpiry
        ? await candidates.findOneAndUpdate(
            { _id: existingAssignment._id },
            { $set: { inviteExpiresAt: expiresAt } },
            { returnDocument: "after" },
          )
        : existingAssignment;

      return {
        candidate: toPublicCandidate(candidate ?? existingAssignment),
        assessment: validAssessments[0],
        assessments: validAssessments,
        existingPending: true,
      } satisfies CreateAssessmentCandidateResult;
    }

    let otpCode = createOtpCode();
    while (await candidates.findOne({ otpCode }, { projection: { _id: 1 } })) {
      otpCode = createOtpCode();
    }

    const now = new Date();
    const assessmentIds = job.assessmentIds.map((id) => new ObjectId(id));
    const result = await candidates.insertOne({
      name,
      email: normalizedEmail,
      assessmentId: assessmentIds[0],
      jobId: new ObjectId(job.id),
      jobTitle: job.title,
      assessmentIds,
      otpCode,
      cvUrl: "https://drive.google.com/file/d/sample-cv-preview/view",
      invitedAt: now,
      inviteExpiresAt: expiresAt,
      inviteEmailStatus: "pending",
    });
    const candidate = await candidates.findOne({ _id: result.insertedId });

    if (!candidate) {
      throw new Error("Candidate was created but could not be loaded.");
    }

    return {
      candidate: toPublicCandidate(candidate),
      assessment: validAssessments[0],
      assessments: validAssessments,
      existingPending: false,
    };
  }

  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) {
    throw new Error("Assessment was not found.");
  }

  const { candidates } = await getCollections();
  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = parseInviteExpiry(inviteExpiresAt);
  const existingAssignments = await candidates
    .find({
      email: normalizedEmail,
      assessmentId: new ObjectId(assessmentId),
    })
    .sort({ invitedAt: -1 })
    .toArray();
  const pendingAssignment = existingAssignments.find((candidate) => !candidate.submittedAt);

  if (pendingAssignment) {
    const shouldRefreshExpiry = Boolean(inviteExpiresAt) || !pendingAssignment.inviteExpiresAt;
    const candidate = shouldRefreshExpiry
      ? await candidates.findOneAndUpdate(
          { _id: pendingAssignment._id },
          { $set: { inviteExpiresAt: expiresAt } },
          { returnDocument: "after" },
        )
      : pendingAssignment;

    return {
      candidate: toPublicCandidate(candidate ?? pendingAssignment),
      assessment,
      existingPending: true,
    } satisfies CreateAssessmentCandidateResult;
  }

  let otpCode = createOtpCode();
  while (await candidates.findOne({ otpCode }, { projection: { _id: 1 } })) {
    otpCode = createOtpCode();
  }

  const now = new Date();
  const result = await candidates.insertOne({
    name,
    email: normalizedEmail,
    assessmentId: new ObjectId(assessmentId),
    otpCode,
    cvUrl: "https://drive.google.com/file/d/sample-cv-preview/view",
    invitedAt: now,
    inviteExpiresAt: expiresAt,
    inviteEmailStatus: "pending",
  });
  const candidate = await candidates.findOne({ _id: result.insertedId });

  if (!candidate) {
    throw new Error("Candidate was created but could not be loaded.");
  }

  return { candidate: toPublicCandidate(candidate), assessment, existingPending: false };
}

export async function getCandidateInviteById(candidateId: string) {
  if (!ObjectId.isValid(candidateId)) return null;

  const { candidates } = await getCollections();
  const candidate = await candidates.findOne({
    _id: new ObjectId(candidateId),
    submittedAt: { $exists: false },
  });

  if (!candidate) return null;
  if (isCandidateInviteExpired(candidate)) return null;

  const assessment = await getAssessmentById(candidate.assessmentId.toString());
  if (!assessment) return null;

  return { candidate: toPublicCandidate(candidate), assessment };
}

export async function updateCandidateInviteStatus(
  candidateId: string,
  status: NonNullable<PublicCandidateRecord["inviteEmailStatus"]>,
  failure?: string | null,
) {
  if (!ObjectId.isValid(candidateId)) return null;

  const { candidates } = await getCollections();
  await candidates.updateOne(
    { _id: new ObjectId(candidateId) },
    {
      $set: {
        inviteEmailStatus: status,
        ...(failure ? { inviteEmailFailure: failure } : {}),
      },
      ...(!failure ? { $unset: { inviteEmailFailure: "" } } : {}),
    },
  );
  const candidate = await candidates.findOne({ _id: new ObjectId(candidateId) });
  return candidate ? toPublicCandidate(candidate) : null;
}

export async function authenticateCandidateOtp(otpCode: string): Promise<{
  candidate: PublicCandidateRecord;
  assessment: PublicAssessment;
  assessments?: PublicAssessment[];
} | null> {
  const { candidates, submissions } = await getCollections();
  const candidate = await candidates.findOne({
    otpCode: otpCode.trim(),
    submittedAt: { $exists: false },
  });

  if (!candidate) return null;
  if (isCandidateInviteExpired(candidate)) return null;

  const assessmentIds = candidate.assessmentIds?.length
    ? candidate.assessmentIds
    : [candidate.assessmentId];
  const submitted = await submissions
    .find(
      {
        candidateId: candidate._id,
        assessmentId: { $in: assessmentIds },
      },
      { projection: { assessmentId: 1 } },
    )
    .toArray();
  const submittedIds = new Set(submitted.map((item) => item.assessmentId.toString()));
  const pendingAssessmentIds = assessmentIds.filter((id) => !submittedIds.has(id.toString()));

  if (!pendingAssessmentIds.length) return null;

  const assessments = (await Promise.all(
    pendingAssessmentIds.map((id) => getAssessmentById(id.toString())),
  )).filter(Boolean) as PublicAssessment[];
  const assessment = assessments[0];
  if (!assessment) return null;

  return { candidate: toPublicCandidate(candidate), assessment, assessments };
}

export async function listHiringRecords() {
  const { candidates, submissions } = await getCollections();
  const [candidateRecords, submissionRecords] = await Promise.all([
    candidates.find().sort({ invitedAt: -1 }).limit(500).toArray(),
    submissions.find().sort({ submittedAt: -1 }).limit(500).toArray(),
  ]);

  return {
    candidates: candidateRecords.map(toPublicCandidate),
    results: submissionRecords.map(toPublicSubmission),
  };
}

export async function getHiringDashboardStats() {
  const { candidates, submissions } = await getCollections();
  const [candidateStats, submissionStats, totals, recentInviteRecords] = await Promise.all([
    candidates
      .aggregate<{ _id: ObjectId; count: number }>([
        {
          $project: {
            assessmentIds: {
              $ifNull: ["$assessmentIds", ["$assessmentId"]],
            },
          },
        },
        { $unwind: "$assessmentIds" },
        { $group: { _id: "$assessmentIds", count: { $sum: 1 } } },
      ])
      .toArray(),
    submissions
      .aggregate<{ _id: ObjectId; count: number; averageScore: number }>([
        {
          $group: {
            _id: "$assessmentId",
            count: { $sum: 1 },
            averageScore: { $avg: "$score" },
          },
        },
      ])
      .toArray(),
    submissions
      .aggregate<{ _id: null; count: number; averageScore: number }>([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            averageScore: { $avg: "$score" },
          },
        },
      ])
      .toArray(),
    candidates.find().sort({ invitedAt: -1 }).limit(8).toArray(),
  ]);

  return {
    submissions: totals[0]?.count ?? 0,
    averageScore: Math.round(totals[0]?.averageScore ?? 0),
    assessments: Object.fromEntries(
      candidateStats.map((item) => [
        item._id.toString(),
        {
          invited: item.count,
          submissions: 0,
          averageScore: 0,
        },
      ]),
    ) as Record<string, { invited: number; submissions: number; averageScore: number }>,
    submissionStats: Object.fromEntries(
      submissionStats.map((item) => [
        item._id.toString(),
        {
          submissions: item.count,
          averageScore: Math.round(item.averageScore ?? 0),
        },
      ]),
    ),
    recentInvites: recentInviteRecords.map((candidate) => {
      const publicCandidate = toPublicCandidate(candidate);
      return {
        id: publicCandidate.id,
        name: publicCandidate.name,
        email: publicCandidate.email,
        jobTitle: publicCandidate.jobTitle ?? publicCandidate.jobId,
        invitedAt: publicCandidate.invitedAt,
        inviteExpiresAt: publicCandidate.inviteExpiresAt,
        isInviteExpired: publicCandidate.isInviteExpired,
        submittedAt: publicCandidate.submittedAt,
      };
    }),
  };
}

export async function getSubmissionById(submissionId: string) {
  if (!ObjectId.isValid(submissionId)) return null;

  const { submissions } = await getCollections();
  const submission = await submissions.findOne({ _id: new ObjectId(submissionId) });
  return submission ? toPublicSubmission(submission) : null;
}

export async function createCandidateSubmission({
  candidateId,
  assessmentId,
  assessmentTitle,
  answers,
  answeredCount,
  totalQuestions,
  score,
  status,
  violations,
}: {
  candidateId: string;
  assessmentId: string;
  assessmentTitle: string;
  answers: Record<string, string>;
  answeredCount: number;
  totalQuestions: number;
  score: number;
  status: "Submitted" | "Auto submitted";
  violations: Array<Omit<AssessmentViolationRecord, "occurredAt"> & { occurredAt: string }>;
}) {
  if (!ObjectId.isValid(candidateId) || !ObjectId.isValid(assessmentId)) {
    throw new Error("Candidate or assessment is not valid.");
  }

  const { candidates, submissions } = await getCollections();
  const candidateObjectId = new ObjectId(candidateId);
  const assessmentObjectId = new ObjectId(assessmentId);
  const candidate = await candidates.findOne({
    _id: candidateObjectId,
    $or: [
      { assessmentId: assessmentObjectId },
      { assessmentIds: assessmentObjectId },
    ],
    submittedAt: { $exists: false },
  });

  if (!candidate) {
    throw new Error("This access code is invalid, expired, or already submitted.");
  }

  if (isCandidateInviteExpired(candidate)) {
    throw new Error("This invitation has expired.");
  }

  const now = new Date();
  const insert = await submissions.insertOne({
    assessmentId: assessmentObjectId,
    assessmentTitle,
    candidateId: candidateObjectId,
    candidateName: candidate.name,
    candidateEmail: candidate.email,
    submittedAt: now,
    answeredCount,
    totalQuestions,
    score,
    status,
    violations: violations.map((violation) => ({
      ...violation,
      occurredAt: new Date(violation.occurredAt),
    })),
    answers,
    reviews: [],
  });

  if (candidate.assessmentIds?.length) {
    const submittedAssessmentCount = await submissions.countDocuments({
      candidateId: candidateObjectId,
      assessmentId: { $in: candidate.assessmentIds },
    });

    if (submittedAssessmentCount >= candidate.assessmentIds.length) {
      await candidates.updateOne(
        { _id: candidateObjectId },
        { $set: { submittedAt: now } },
      );
    }
  } else {
    await candidates.updateOne(
      { _id: candidateObjectId },
      { $set: { submittedAt: now } },
    );
  }
  const submission = await submissions.findOne({ _id: insert.insertedId });

  if (!submission) {
    throw new Error("Submission was saved but could not be loaded.");
  }

  return toPublicSubmission(submission);
}

export async function addSubmissionReview({
  submissionId,
  adminId,
  adminName,
  adminEmail,
  action,
  textScores,
  score,
}: {
  submissionId: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: SubmissionReviewRecord["action"];
  textScores?: Record<string, number>;
  score?: number;
}) {
  if (!ObjectId.isValid(submissionId) || !ObjectId.isValid(adminId)) {
    throw new Error("Submission or admin is not valid.");
  }

  const { submissions } = await getCollections();
  const existingSubmission = await submissions.findOne(
    { _id: new ObjectId(submissionId) },
    { projection: { decision: 1 } },
  );

  if (!existingSubmission) {
    throw new Error("Submission was not found.");
  }

  if (existingSubmission.decision) {
    throw new Error("This submission already has a final review decision.");
  }

  const now = new Date();
  const review: SubmissionReviewRecord = {
    id: crypto.randomUUID(),
    adminId: new ObjectId(adminId),
    adminName,
    adminEmail,
    action,
    createdAt: now,
  };
  const update: Parameters<Collection<SubmissionDocument>["updateOne"]>[1] = {
    $push: { reviews: review },
    $set: {
      evaluatedAt: now,
      evaluatedBy: {
        adminId: new ObjectId(adminId),
        name: adminName,
        email: adminEmail,
      },
      ...(action === "accepted" || action === "rejected" || action === "forwarded"
        ? { decision: action }
        : {}),
      ...(textScores ? { textScores } : {}),
      ...(typeof score === "number" ? { score } : {}),
    },
  };

  await submissions.updateOne({ _id: new ObjectId(submissionId) }, update);
  return getSubmissionById(submissionId);
}
