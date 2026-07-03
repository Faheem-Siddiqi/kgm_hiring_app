import "server-only";

import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";
import { getAssessmentById } from "@/lib/assessments";
import { buildAssessmentSectionsFromResource } from "@/features/test/assessment-resources";
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

type CandidateAttemptDocument = {
  candidateId: ObjectId;
  assessmentId: ObjectId;
  status: "Not Started" | "In Progress" | "Submitted" | "Expired";
  startedAt?: Date;
  updatedAt: Date;
  currentSectionSlug?: string;
  currentQuestionId?: string;
  answers: Record<string, string>;
  questionStatuses: Record<string, "answered" | "skipped" | "unanswered">;
  sectionDeadlines: Record<string, Date>;
  questionDeadlines: Record<string, Date>;
  violations: AssessmentViolationRecord[];
  submittedAt?: Date;
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

export type PublicCandidateAttemptRecord = {
  id: string;
  candidateId: string;
  assessmentId: string;
  status: CandidateAttemptDocument["status"];
  startedAt?: string;
  updatedAt: string;
  currentSectionSlug?: string;
  currentQuestionId?: string;
  answers: Record<string, string>;
  questionStatuses: Record<string, "answered" | "skipped" | "unanswered">;
  sectionDeadlines: Record<string, string>;
  questionDeadlines: Record<string, string>;
  violations: Array<Omit<AssessmentViolationRecord, "occurredAt"> & { occurredAt: string }>;
  submittedAt?: string;
  serverNow: string;
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
    const attempts = database.collection<CandidateAttemptDocument>("candidateAssessmentAttempts");
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
      attempts.createIndex({ candidateId: 1, assessmentId: 1 }, { unique: true }),
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
    attempts: database.collection<CandidateAttemptDocument>("candidateAssessmentAttempts"),
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

function toPublicAttempt(attempt: WithId<CandidateAttemptDocument>): PublicCandidateAttemptRecord {
  return {
    id: attempt._id.toString(),
    candidateId: attempt.candidateId.toString(),
    assessmentId: attempt.assessmentId.toString(),
    status: attempt.status,
    ...(attempt.startedAt ? { startedAt: attempt.startedAt.toISOString() } : {}),
    updatedAt: attempt.updatedAt.toISOString(),
    currentSectionSlug: attempt.currentSectionSlug,
    currentQuestionId: attempt.currentQuestionId,
    answers: attempt.answers ?? {},
    questionStatuses: attempt.questionStatuses ?? {},
    sectionDeadlines: Object.fromEntries(
      Object.entries(attempt.sectionDeadlines ?? {}).map(([key, value]) => [
        key,
        value.toISOString(),
      ]),
    ),
    questionDeadlines: Object.fromEntries(
      Object.entries(attempt.questionDeadlines ?? {}).map(([key, value]) => [
        key,
        value.toISOString(),
      ]),
    ),
    violations: (attempt.violations ?? []).map((violation) => ({
      ...violation,
      occurredAt: violation.occurredAt.toISOString(),
    })),
    ...(attempt.submittedAt ? { submittedAt: attempt.submittedAt.toISOString() } : {}),
    serverNow: new Date().toISOString(),
  };
}

function buildAssessmentSections(assessment: PublicAssessment) {
  const sectionTypeConfigs = Object.fromEntries(
    assessment.sectionSettings.map((section) => [section.sectionId, section.types]),
  );
  const questionsPerSection = Math.max(
    1,
    ...assessment.sectionSettings.map(
      (section) =>
        section.types.mcq.quantity +
        section.types.multi.quantity +
        section.types.text.quantity,
    ),
  );
  const timePerSectionMinutes = Math.max(
    1,
    ...assessment.sectionSettings.map((section) =>
      Math.ceil(
        Math.max(
          section.types.mcq.timeLimitSeconds,
          section.types.multi.timeLimitSeconds,
          section.types.text.timeLimitSeconds,
        ) / 60,
      ),
    ),
  );

  return buildAssessmentSectionsFromResource({
    resourceId: assessment.questionBankId,
    sectionCount: assessment.sectionCount,
    questionsPerSection,
    timePerSectionMinutes,
    seed: assessment.id,
    sectionTypeConfigs,
  });
}

async function calculateSubmissionScore({
  assessmentId,
  answers,
  textScores = {},
}: {
  assessmentId: string;
  answers: Record<string, string>;
  textScores?: Record<string, number>;
}) {
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) return 0;

  const questions = buildAssessmentSections(assessment).flatMap(
    (section) => section.questions,
  );
  const totalPoints = questions.length;
  const earnedPoints = questions.reduce((total, question) => {
    if (question.type === "text") {
      return total + Math.min(10, Math.max(0, textScores[question.id] ?? 0)) / 10;
    }

    const expected = question.correctAnswers ?? [];
    const provided = (answers[question.id] ?? "").split("||").filter(Boolean);

    if (!expected.length) return total;
    if (question.type === "mcq") {
      return total + (provided[0] === expected[0] ? 1 : 0);
    }

    const correctSelections = provided.filter((value) => expected.includes(value)).length;
    const incorrectSelections = provided.filter((value) => !expected.includes(value)).length;

    return total + Math.max(
      0,
      correctSelections / expected.length - incorrectSelections / expected.length,
    );
  }, 0);

  return totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
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
  attempts?: PublicCandidateAttemptRecord[];
} | null> {
  const { candidates, submissions, attempts } = await getCollections();
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

  const attemptRecords = await attempts
    .find({ candidateId: candidate._id, assessmentId: { $in: assessmentIds } })
    .toArray();

  return {
    candidate: toPublicCandidate(candidate),
    assessment,
    assessments,
    attempts: attemptRecords.map(toPublicAttempt),
  };
}

export async function getCandidateAttempts(candidateId: string) {
  if (!ObjectId.isValid(candidateId)) return [];

  const { attempts } = await getCollections();
  const records = await attempts
    .find({ candidateId: new ObjectId(candidateId) })
    .sort({ updatedAt: -1 })
    .toArray();

  return records.map(toPublicAttempt);
}

async function getActiveCandidateForAssessment(candidateId: string, assessmentId: string) {
  if (!ObjectId.isValid(candidateId) || !ObjectId.isValid(assessmentId)) {
    throw new Error("Candidate or assessment is not valid.");
  }

  const { candidates, submissions } = await getCollections();
  const candidateObjectId = new ObjectId(candidateId);
  const assessmentObjectId = new ObjectId(assessmentId);
  const [candidate, existingSubmission] = await Promise.all([
    candidates.findOne({
      _id: candidateObjectId,
      $or: [
        { assessmentId: assessmentObjectId },
        { assessmentIds: assessmentObjectId },
      ],
      submittedAt: { $exists: false },
    }),
    submissions.findOne(
      { candidateId: candidateObjectId, assessmentId: assessmentObjectId },
      { projection: { _id: 1 } },
    ),
  ]);

  if (!candidate || existingSubmission) {
    throw new Error("This assessment is already submitted or no longer available.");
  }

  if (isCandidateInviteExpired(candidate)) {
    throw new Error("This assessment invitation has expired.");
  }

  return { candidate, candidateObjectId, assessmentObjectId };
}

export async function startOrResumeCandidateAttempt({
  candidateId,
  assessmentId,
  sectionDurations,
}: {
  candidateId: string;
  assessmentId: string;
  sectionDurations: Record<string, number>;
  questionDurations: Record<string, number>;
}) {
  const { candidateObjectId, assessmentObjectId } = await getActiveCandidateForAssessment(
    candidateId,
    assessmentId,
  );
  const { attempts } = await getCollections();
  const existingAttempt = await attempts.findOne({
    candidateId: candidateObjectId,
    assessmentId: assessmentObjectId,
  });

  if (existingAttempt?.submittedAt || existingAttempt?.status === "Submitted") {
    throw new Error("This assessment is already submitted and cannot be reopened.");
  }

  if (existingAttempt) {
    return toPublicAttempt(existingAttempt);
  }

  const now = new Date();
  const sectionDeadlines = Object.fromEntries(
    Object.entries(sectionDurations).map(([key, seconds]) => [
      key,
      new Date(now.getTime() + Math.max(0, Math.round(seconds)) * 1000),
    ]),
  );
  const insert = await attempts.insertOne({
    candidateId: candidateObjectId,
    assessmentId: assessmentObjectId,
    status: "In Progress",
    startedAt: now,
    updatedAt: now,
    answers: {},
    questionStatuses: {},
    sectionDeadlines,
    questionDeadlines: {},
    violations: [],
  });
  const attempt = await attempts.findOne({ _id: insert.insertedId });

  if (!attempt) {
    throw new Error("Assessment attempt was created but could not be loaded.");
  }

  return toPublicAttempt(attempt);
}

export async function saveCandidateAttemptProgress({
  candidateId,
  assessmentId,
  answers,
  questionStatuses,
  currentSectionSlug,
  currentQuestionId,
  violations,
  questionDurations,
}: {
  candidateId: string;
  assessmentId: string;
  answers: Record<string, string>;
  questionStatuses: Record<string, "answered" | "skipped" | "unanswered">;
  currentSectionSlug?: string;
  currentQuestionId?: string;
  violations?: Array<Omit<AssessmentViolationRecord, "occurredAt"> & { occurredAt: string }>;
  questionDurations?: Record<string, number>;
}) {
  const { candidateObjectId, assessmentObjectId } = await getActiveCandidateForAssessment(
    candidateId,
    assessmentId,
  );
  const { attempts } = await getCollections();
  const now = new Date();

  const existingAttempt = await attempts.findOne({
    candidateId: candidateObjectId,
    assessmentId: assessmentObjectId,
    submittedAt: { $exists: false },
  });

  if (!existingAttempt) {
    throw new Error("This assessment attempt is already submitted or unavailable.");
  }

  const questionDeadlineUpdates =
    currentQuestionId &&
    questionDurations?.[currentQuestionId] !== undefined &&
    !existingAttempt.questionDeadlines?.[currentQuestionId]
      ? {
          [`questionDeadlines.${currentQuestionId}`]: new Date(
            now.getTime() +
              Math.max(0, Math.round(questionDurations[currentQuestionId])) * 1000,
          ),
        }
      : {};

  const result = await attempts.findOneAndUpdate(
    {
      candidateId: candidateObjectId,
      assessmentId: assessmentObjectId,
      submittedAt: { $exists: false },
    },
    {
      $set: {
        status: "In Progress",
        updatedAt: now,
        answers,
        questionStatuses,
        ...(currentSectionSlug ? { currentSectionSlug } : {}),
        ...(currentQuestionId ? { currentQuestionId } : {}),
        ...questionDeadlineUpdates,
        ...(violations
          ? {
              violations: violations.map((violation) => ({
                ...violation,
                occurredAt: new Date(violation.occurredAt),
              })),
            }
          : {}),
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    throw new Error("This assessment attempt is already submitted or unavailable.");
  }

  return toPublicAttempt(result);
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

  const { candidates, submissions, attempts } = await getCollections();
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
  const existingSubmission = await submissions.findOne(
    { candidateId: candidateObjectId, assessmentId: assessmentObjectId },
    { projection: { _id: 1 } },
  );

  if (existingSubmission) {
    throw new Error("This assessment is already submitted and cannot be reopened.");
  }

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

  const assignedAssessmentIds = candidate.assessmentIds?.length
    ? candidate.assessmentIds
    : [candidate.assessmentId];
  const submittedAssessmentIds = await submissions
    .find(
      {
        candidateId: candidateObjectId,
        assessmentId: { $in: assignedAssessmentIds },
      },
      { projection: { assessmentId: 1 } },
    )
    .toArray();

  if (submittedAssessmentIds.length >= assignedAssessmentIds.length) {
    await candidates.updateOne(
      { _id: candidateObjectId },
      { $set: { submittedAt: now } },
    );
  }

  const submission = await submissions.findOne({ _id: insert.insertedId });

  if (!submission) {
    throw new Error("Submission was saved but could not be loaded.");
  }

  await attempts.updateOne(
    { candidateId: candidateObjectId, assessmentId: assessmentObjectId },
    {
      $set: {
        status: "Submitted",
        submittedAt: now,
        updatedAt: now,
        answers,
        violations: violations.map((violation) => ({
          ...violation,
          occurredAt: new Date(violation.occurredAt),
        })),
      },
    },
  );

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
    { projection: { decision: 1, evaluatedAt: 1, assessmentId: 1, answers: 1, textScores: 1 } },
  );

  if (!existingSubmission) {
    throw new Error("Submission was not found.");
  }

  if (existingSubmission.decision) {
    throw new Error("This submission already has a final review decision.");
  }

  if (action === "evaluated" && existingSubmission.evaluatedAt) {
    throw new Error("This submission has already been evaluated and cannot be evaluated again.");
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
  const nextTextScores = textScores
    ? { ...(existingSubmission.textScores ?? {}), ...textScores }
    : existingSubmission.textScores;
  const nextScore =
    action === "evaluated"
      ? await calculateSubmissionScore({
          assessmentId: existingSubmission.assessmentId.toString(),
          answers: existingSubmission.answers ?? {},
          textScores: nextTextScores,
        })
      : score;
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
      ...(nextTextScores ? { textScores: nextTextScores } : {}),
      ...(typeof nextScore === "number" ? { score: nextScore } : {}),
    },
  };

  await submissions.updateOne({ _id: new ObjectId(submissionId) }, update);
  return getSubmissionById(submissionId);
}
