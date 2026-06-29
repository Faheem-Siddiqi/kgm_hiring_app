import "server-only";

import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";
import {
  assessmentResourceSummaries,
  type AssessmentResourceSummary,
} from "@/features/test/assessment-resources";
import type {
  AssessmentListSummary,
  AssessmentQuestionType,
  AssessmentSectionSetting,
  AssessmentTypeSetting,
  PublicAssessment,
} from "@/lib/assessment-types";
import type { JobDocument } from "@/lib/jobs";

type AssessmentDocument = {
  code: string;
  name: string;
  description: string;
  questionBankId: string;
  sectionSettings: AssessmentSectionSetting[];
  createdAt: Date;
  updatedAt: Date;
};

type AssessmentAggregateDocument = WithId<AssessmentDocument> & {
  assignedJobs?: Array<WithId<JobDocument>>;
};

export class AssessmentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AssessmentError";
  }
}

const DEFAULT_TYPE_SECONDS: Record<AssessmentQuestionType, number> = {
  mcq: 50,
  multi: 75,
  text: 180,
};

let indexesReady: Promise<void> | null = null;

function getQuestionBankLabel(questionBankId: string) {
  return (
    assessmentResourceSummaries.find((resource) => resource.id === questionBankId)
      ?.role ?? questionBankId
  );
}

function toPublicAssessment(
  assessment: AssessmentAggregateDocument,
): PublicAssessment {
  const assignedJobs = (assessment.assignedJobs ?? []).map((job) => ({
    id: job._id.toString(),
    title: job.title,
    slug: job.slug,
    department: job.department,
    location: job.location,
    status: job.status,
  }));
  const totalQuestions = assessment.sectionSettings.reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (["mcq", "multi", "text"] as const).reduce(
        (typeTotal, type) => typeTotal + section.types[type].quantity,
        0,
      ),
    0,
  );

  return {
    id: assessment._id.toString(),
    code: assessment.code,
    name: assessment.name,
    description: assessment.description,
    questionBankId: assessment.questionBankId,
    questionBankName: getQuestionBankLabel(assessment.questionBankId),
    sectionCount: assessment.sectionSettings.length,
    totalQuestions,
    sectionSettings: assessment.sectionSettings,
    assignedJobIds: assignedJobs.map((job) => job.id),
    assignedJobs,
    createdAt: assessment.createdAt.toISOString(),
    updatedAt: assessment.updatedAt.toISOString(),
  };
}

async function ensureAssessmentIndexes(database: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      database.collection<AssessmentDocument>("assessments").createIndex(
        { code: 1 },
        { unique: true },
      ),
      database
        .collection<AssessmentDocument>("assessments")
        .createIndex({ questionBankId: 1, updatedAt: -1 }),
      database
        .collection<AssessmentDocument>("assessments")
        .createIndex({ updatedAt: -1, createdAt: -1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesReady = null;
        throw error;
      });
  }

  return indexesReady;
}

async function getAssessmentCollection(): Promise<Collection<AssessmentDocument>> {
  const database = await getDatabase();
  await ensureAssessmentIndexes(database);
  return database.collection<AssessmentDocument>("assessments");
}

function requireQuestionBank(questionBankId: string) {
  const bank = assessmentResourceSummaries.find(
    (resource) => resource.id === questionBankId,
  );

  if (!bank) {
    throw new AssessmentError("Question Bank is not valid.", 400);
  }

  return bank;
}

function parsePositiveInteger(value: unknown, label: string, max?: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new AssessmentError(`${label} must be a number.`, 400);
  }

  const rounded = Math.round(parsed);

  if (rounded < 0) {
    throw new AssessmentError(`${label} cannot be negative.`, 400);
  }

  if (max !== undefined && rounded > max) {
    throw new AssessmentError(`${label} cannot exceed ${max}.`, 400);
  }

  return rounded;
}

function parseTimeSeconds(value: unknown, label: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new AssessmentError(`${label} must be a number.`, 400);
  }

  const rounded = Math.round(parsed);

  if (rounded < 1 || rounded > 3600) {
    throw new AssessmentError(`${label} must be between 1 and 3600 seconds.`, 400);
  }

  return rounded;
}

function parseTypeTimeSeconds(quantity: number, value: unknown, label: string) {
  if (quantity === 0) {
    return 0;
  }

  return parseTimeSeconds(value, label);
}

function sanitizeSectionSettings(
  questionBank: AssessmentResourceSummary,
  rawSettings: unknown,
) {
  if (!Array.isArray(rawSettings)) {
    throw new AssessmentError("Section settings are required.", 400);
  }

  if (!rawSettings.length) {
    throw new AssessmentError("At least one section must be selected.", 400);
  }

  if (rawSettings.length > questionBank.sectionCount) {
    throw new AssessmentError(
      `Question Bank has only ${questionBank.sectionCount} sections.`,
      400,
    );
  }

  const seenSections = new Set<string>();
  const settings: AssessmentSectionSetting[] = rawSettings.map((rawSection) => {
    const sectionInput = rawSection as {
      sectionId?: unknown;
      types?: Partial<Record<AssessmentQuestionType, Partial<AssessmentTypeSetting>>>;
    };
    const sectionId =
      typeof sectionInput.sectionId === "string"
        ? sectionInput.sectionId.trim()
        : "";
    const sourceSection = questionBank.sections.find(
      (section) => section.id === sectionId,
    );

    if (!sourceSection) {
      throw new AssessmentError("Selected section is not in this Question Bank.", 400);
    }

    if (seenSections.has(sectionId)) {
      throw new AssessmentError("Duplicate sections are not allowed.", 400);
    }

    seenSections.add(sectionId);

    const types = (["mcq", "multi", "text"] as const).reduce(
      (next, type) => {
        const sourceCount = sourceSection.counts[type];
        const typeInput = sectionInput.types?.[type] ?? {};
        const quantity = parsePositiveInteger(
          typeInput.quantity ?? 0,
          `${sourceSection.title} ${type.toUpperCase()} quantity`,
          sourceCount,
        );
        const timeLimitSeconds = parseTypeTimeSeconds(
          quantity,
          typeInput.timeLimitSeconds ?? DEFAULT_TYPE_SECONDS[type],
          `${sourceSection.title} ${type.toUpperCase()} time`,
        );

        return {
          ...next,
          [type]: { quantity, timeLimitSeconds },
        };
      },
      {} as Record<AssessmentQuestionType, AssessmentTypeSetting>,
    );
    const sectionQuestionTotal =
      types.mcq.quantity + types.multi.quantity + types.text.quantity;

    if (!sectionQuestionTotal) {
      throw new AssessmentError(
        `${sourceSection.title} must include at least one question type.`,
        400,
      );
    }

    return {
      sectionId,
      sectionTitle: sourceSection.title,
      types,
    };
  });
  const totalQuestions = settings.reduce(
    (total, section) =>
      total + section.types.mcq.quantity + section.types.multi.quantity + section.types.text.quantity,
    0,
  );

  if (!totalQuestions) {
    throw new AssessmentError("Assessment must include at least one question.", 400);
  }

  return settings;
}

async function createAssessmentCode() {
  const assessments = await getAssessmentCollection();
  const total = await assessments.countDocuments();
  let counter = total + 1;

  while (counter < total + 1000) {
    const code = `KGM-ASMT-${String(counter).padStart(4, "0")}`;
    const existing = await assessments.findOne({ code }, { projection: { _id: 1 } });

    if (!existing) {
      return code;
    }

    counter += 1;
  }

  return `KGM-ASMT-${Date.now()}`;
}

export async function parseAssessmentInput(input: {
  name?: unknown;
  description?: unknown;
  questionBankId?: unknown;
  sectionSettings?: unknown;
}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const questionBankId =
    typeof input.questionBankId === "string" ? input.questionBankId.trim() : "";
  const questionBank = requireQuestionBank(questionBankId);

  if (!name || !description) {
    throw new AssessmentError("Assessment name and description are required.", 400);
  }

  return {
    name,
    description,
    questionBankId,
    sectionSettings: sanitizeSectionSettings(
      questionBank,
      input.sectionSettings,
    ),
  };
}

export async function listAssessments() {
  const assessments = await getAssessmentCollection();
  const pipeline = [
    { $sort: { updatedAt: -1, createdAt: -1 } },
    {
      $lookup: {
        from: "jobs",
        localField: "_id",
        foreignField: "assessmentIds",
        as: "assignedJobs",
      },
    },
    {
      $facet: {
        assessments: [{ $limit: 100 }],
        total: [{ $count: "count" }],
        assigned: [
          { $match: { assignedJobs: { $exists: true, $ne: [] } } },
          { $count: "count" },
        ],
        unassigned: [
          { $match: { assignedJobs: [] } },
          { $count: "count" },
        ],
      },
    },
  ];
  const [result] = await assessments
    .aggregate<{
      assessments: AssessmentAggregateDocument[];
      total: Array<{ count: number }>;
      assigned: Array<{ count: number }>;
      unassigned: Array<{ count: number }>;
    }>(pipeline)
    .toArray();
  const summary = {
    total: result?.total[0]?.count ?? 0,
    assigned: result?.assigned[0]?.count ?? 0,
    unassigned: result?.unassigned[0]?.count ?? 0,
  } satisfies AssessmentListSummary;

  return {
    assessments: (result?.assessments ?? []).map(toPublicAssessment),
    questionBanks: assessmentResourceSummaries,
    summary,
  };
}

export async function createAssessment(input: Awaited<ReturnType<typeof parseAssessmentInput>>) {
  const assessments = await getAssessmentCollection();
  const now = new Date();
  const result = await assessments.insertOne({
    code: await createAssessmentCode(),
    name: input.name,
    description: input.description,
    questionBankId: input.questionBankId,
    sectionSettings: input.sectionSettings,
    createdAt: now,
    updatedAt: now,
  });
  const [assessment] = await assessments
    .aggregate<AssessmentAggregateDocument>([
      { $match: { _id: result.insertedId } },
      {
        $lookup: {
          from: "jobs",
          localField: "_id",
          foreignField: "assessmentIds",
          as: "assignedJobs",
        },
      },
    ])
    .toArray();

  if (!assessment) {
    throw new AssessmentError("Assessment was created but could not be loaded.", 500);
  }

  return toPublicAssessment(assessment);
}

export async function getAssessmentById(assessmentId: string) {
  if (!ObjectId.isValid(assessmentId)) {
    return null;
  }

  const assessments = await getAssessmentCollection();
  const [assessment] = await assessments
    .aggregate<AssessmentAggregateDocument>([
      { $match: { _id: new ObjectId(assessmentId) } },
      {
        $lookup: {
          from: "jobs",
          localField: "_id",
          foreignField: "assessmentIds",
          as: "assignedJobs",
        },
      },
      { $limit: 1 },
    ])
    .toArray();

  return assessment ? toPublicAssessment(assessment) : null;
}

export async function updateAssessment(
  assessmentId: string,
  input: Awaited<ReturnType<typeof parseAssessmentInput>>,
) {
  if (!ObjectId.isValid(assessmentId)) {
    throw new AssessmentError("Assessment is not valid.", 400);
  }

  const assessments = await getAssessmentCollection();
  const result = await assessments.updateOne(
    { _id: new ObjectId(assessmentId) },
    {
      $set: {
        name: input.name,
        description: input.description,
        questionBankId: input.questionBankId,
        sectionSettings: input.sectionSettings,
        updatedAt: new Date(),
      },
    },
  );

  if (!result.matchedCount) {
    throw new AssessmentError("Assessment was not found.", 404);
  }

  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) {
    throw new AssessmentError("Assessment was not found.", 404);
  }

  return assessment;
}
