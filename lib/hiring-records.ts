import "server-only";

import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";
import { getAssessmentById } from "@/lib/assessments";
import type { PublicAssessment } from "@/lib/assessment-types";

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
  remark: string;
  action: "evaluated" | "accepted" | "rejected" | "forwarded";
  createdAt: Date;
};

type CandidateDocument = {
  name: string;
  email: string;
  assessmentId: ObjectId;
  otpCode: string;
  cvUrl: string;
  invitedAt: Date;
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
    remark: string;
  };
  decision?: "accepted" | "rejected" | "forwarded";
};

export type PublicCandidateRecord = {
  id: string;
  name: string;
  email: string;
  jobId: string;
  otpCode: string;
  canViewOtp?: boolean;
  cvUrl: string;
  invitedAt: string;
  inviteEmailStatus?: "pending" | "sent" | "failed";
  inviteEmailFailure?: string;
  submittedAt?: string;
};

export type PublicSubmissionReview = {
  id: string;
  adminName: string;
  adminEmail: string;
  remark: string;
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
  adminRemark?: string;
  evaluatedAt?: string;
  evaluatedBy?: {
    name: string;
    email: string;
    remark: string;
  };
  decision?: "accepted" | "rejected" | "forwarded";
  reviews: PublicSubmissionReview[];
};

export type CreateAssessmentCandidateResult = {
  candidate: PublicCandidateRecord;
  assessment: PublicAssessment;
  existingPending: boolean;
};

let indexesReady: Promise<void> | null = null;

function createOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function ensureIndexes(database: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      database.collection<CandidateDocument>("assessmentCandidates").createIndex(
        { otpCode: 1 },
        { unique: true },
      ),
      database
        .collection<CandidateDocument>("assessmentCandidates")
        .createIndex({ assessmentId: 1, invitedAt: -1 }),
      database
        .collection<SubmissionDocument>("assessmentSubmissions")
        .createIndex({ assessmentId: 1, submittedAt: -1 }),
      database
        .collection<SubmissionDocument>("assessmentSubmissions")
        .createIndex({ candidateId: 1 }, { unique: true }),
    ])
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
  return {
    id: candidate._id.toString(),
    name: candidate.name,
    email: candidate.email,
    jobId: candidate.assessmentId.toString(),
    otpCode: candidate.otpCode,
    cvUrl: candidate.cvUrl,
    invitedAt: candidate.invitedAt.toISOString(),
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
        remark: submission.evaluatedBy.remark,
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
    adminRemark: evaluatedBy?.remark,
    ...(submission.evaluatedAt ? { evaluatedAt: submission.evaluatedAt.toISOString() } : {}),
    evaluatedBy,
    decision: submission.decision,
    reviews: (submission.reviews ?? []).map((review) => ({
      id: review.id,
      adminName: review.adminName,
      adminEmail: review.adminEmail,
      remark: review.remark,
      action: review.action,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

export async function createAssessmentCandidate({
  name,
  email,
  assessmentId,
}: {
  name: string;
  email: string;
  assessmentId: string;
}) {
  if (!ObjectId.isValid(assessmentId)) {
    throw new Error("Assessment is not valid.");
  }

  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) {
    throw new Error("Assessment was not found.");
  }

  const { candidates } = await getCollections();
  const normalizedEmail = email.trim().toLowerCase();
  const existingAssignments = await candidates
    .find({
      email: normalizedEmail,
      assessmentId: new ObjectId(assessmentId),
    })
    .sort({ invitedAt: -1 })
    .toArray();
  const pendingAssignment = existingAssignments.find((candidate) => !candidate.submittedAt);

  if (pendingAssignment) {
    return {
      candidate: toPublicCandidate(pendingAssignment),
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
} | null> {
  const { candidates } = await getCollections();
  const candidate = await candidates.findOne({
    otpCode: otpCode.trim(),
    submittedAt: { $exists: false },
  });

  if (!candidate) return null;

  const assessment = await getAssessmentById(candidate.assessmentId.toString());
  if (!assessment) return null;

  return { candidate: toPublicCandidate(candidate), assessment };
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
    assessmentId: assessmentObjectId,
    submittedAt: { $exists: false },
  });

  if (!candidate) {
    throw new Error("This access code is invalid, expired, or already submitted.");
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

  await candidates.updateOne(
    { _id: candidateObjectId },
    { $set: { submittedAt: now } },
  );
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
  remark,
  action,
  textScores,
  score,
}: {
  submissionId: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  remark: string;
  action: SubmissionReviewRecord["action"];
  textScores?: Record<string, number>;
  score?: number;
}) {
  if (!ObjectId.isValid(submissionId) || !ObjectId.isValid(adminId)) {
    throw new Error("Submission or admin is not valid.");
  }

  const { submissions } = await getCollections();
  const now = new Date();
  const review: SubmissionReviewRecord = {
    id: crypto.randomUUID(),
    adminId: new ObjectId(adminId),
    adminName,
    adminEmail,
    remark,
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
        remark,
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
