import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

function createOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildAssessment(resource, index) {
  const sections = resource.sections.slice(0, 2);
  const now = new Date();

  return {
    _id: new ObjectId(),
    code: `KGM-DEMO-${String(index + 1).padStart(4, "0")}`,
    name: `${resource.role} Interview Assessment ${index + 1}`,
    description:
      "Demo assessment with 2 sections, 5 mostly MCQ questions in each section, and a total time of 30 minutes.",
    questionBankId: resource.id,
    sectionSettings: sections.map((section) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      types: {
        mcq: { quantity: 4, timeLimitSeconds: 120 },
        multi: { quantity: 1, timeLimitSeconds: 120 },
        text: { quantity: 0, timeLimitSeconds: 0 },
      },
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function shuffleWithSeed(items, seed) {
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

function toRuntimeQuestions(section, seed) {
  const singleQuestions = (section.single ?? []).map((question, index) => ({
    id: `${section.id}-single-${index + 1}`,
    type: "mcq",
    options: question.o,
    correctAnswers: question.a.map((answerIndex) => question.o[answerIndex]),
  }));
  const multiQuestions = (section.multi ?? []).map((question, index) => ({
    id: `${section.id}-multi-${index + 1}`,
    type: "multi",
    options: question.o,
    correctAnswers: question.a.map((answerIndex) => question.o[answerIndex]),
  }));

  return shuffleWithSeed([...singleQuestions, ...multiQuestions], seed);
}

function pickWrongAnswer(question) {
  return question.options.find((option) => !question.correctAnswers.includes(option)) ?? "";
}

function buildSubmissionAnswers(resource, assessment, correctCount) {
  const answers = {};
  let answered = 0;

  for (const sectionSetting of assessment.sectionSettings) {
    const section = resource.sections.find((item) => item.id === sectionSetting.sectionId);
    if (!section) continue;

    const runtimeQuestions = toRuntimeQuestions(section, `${assessment._id.toString()}-${section.id}`);
    const selectedQuestions = [
      ...runtimeQuestions
        .filter((question) => question.type === "mcq")
        .slice(0, sectionSetting.types.mcq.quantity),
      ...runtimeQuestions
        .filter((question) => question.type === "multi")
        .slice(0, sectionSetting.types.multi.quantity),
    ];

    selectedQuestions.forEach((question) => {
      const isCorrect = answered < correctCount;
      answers[question.id] = isCorrect
        ? question.correctAnswers.join("||")
        : pickWrongAnswer(question);
      answered += 1;
    });
  }

  return answers;
}

function buildQuestionStatuses(answers) {
  return Object.fromEntries(Object.keys(answers).map((questionId) => [questionId, "answered"]));
}

const demoScenarios = [
  {
    name: "Ayesha Khan",
    email: "ayesha.khan@example.com",
    applicationDecision: "invited",
    finalDecision: "accepted",
    score: 100,
    correctCount: 10,
    note: "All answers correct. Excellent fit.",
  },
  {
    name: "Bilal Ahmed",
    email: "bilal.ahmed@example.com",
    applicationDecision: "invited",
    finalDecision: "accepted",
    score: 86,
    correctCount: 9,
    note: "Strong score with one wrong answer.",
  },
  {
    name: "Hina Malik",
    email: "hina.malik@example.com",
    applicationDecision: "invited",
    finalDecision: "forwarded",
    score: 70,
    correctCount: 7,
    note: "Good score, forwarded for senior review.",
  },
  {
    name: "Usman Raza",
    email: "usman.raza@example.com",
    applicationDecision: "invited",
    finalDecision: undefined,
    score: 60,
    correctCount: 6,
    note: "Mixed answers, pending final review.",
  },
  {
    name: "Mariam Noor",
    email: "mariam.noor@example.com",
    applicationDecision: "invited",
    finalDecision: "rejected",
    score: 42,
    correctCount: 4,
    note: "Below required benchmark.",
  },
  {
    name: "Danish Ali",
    email: "danish.ali@example.com",
    applicationDecision: "invited",
    finalDecision: "rejected",
    score: 20,
    correctCount: 2,
    note: "Mostly wrong answers.",
  },
  {
    name: "Sana Iqbal",
    email: "sana.iqbal@example.com",
    applicationDecision: "rejected",
    finalDecision: "rejected",
    score: 0,
    correctCount: 0,
    note: "All answers wrong.",
  },
  {
    name: "Omer Farooq",
    email: "omer.farooq@example.com",
    applicationDecision: "pending",
    finalDecision: undefined,
    score: 78,
    correctCount: 8,
    note: "Application pending, assessment data kept for dashboard variety.",
  },
];

loadEnv();

const uri = process.env.MONGODB_URI?.trim();
const databaseName = process.env.MONGODB_DB?.trim();

if (!uri || !databaseName) {
  throw new Error("MONGODB_URI and MONGODB_DB must be configured.");
}

const resource = JSON.parse(
  fs.readFileSync(path.join(rootDir, "features/test/resources/admin-officer.json"), "utf8"),
);
const client = new MongoClient(uri, {
  appName: "kgm-hiring-reset-demo-data",
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

try {
  await client.connect();
  const db = client.db(databaseName);
  const jobs = await db.collection("jobs").find({}).sort({ createdAt: 1 }).limit(10).toArray();

  if (!jobs.length) {
    throw new Error("No jobs found. Admins and jobs were preserved, so create a job before seeding demo data.");
  }

  await Promise.all([
    db.collection("assessments").deleteMany({}),
    db.collection("assessmentCandidates").deleteMany({}),
    db.collection("assessmentSubmissions").deleteMany({}),
    db.collection("candidateAssessmentAttempts").deleteMany({}),
    db.collection("candidate_applications").deleteMany({}),
  ]);

  const assessments = [buildAssessment(resource, 0), buildAssessment(resource, 1)];
  await db.collection("assessments").insertMany(assessments);

  await Promise.all(
    jobs.map((job, index) =>
      db.collection("jobs").updateOne(
        { _id: job._id },
        {
          $set: {
            assessmentIds: [assessments[index % assessments.length]._id],
            updatedAt: new Date(),
          },
        },
      ),
    ),
  );

  const now = new Date();
  const admin = await db.collection("adminUsers").findOne({}) ?? {
    _id: new ObjectId(),
    name: "KGM Admin",
    email: process.env.ADMIN_EMAIL ?? "admin@example.com",
  };

  const usedOtpCodes = new Set();
  const applicationDocs = [];
  const candidateDocs = [];
  const submissionDocs = [];
  const attemptDocs = [];

  for (const [index, scenario] of demoScenarios.entries()) {
    const job = jobs[index % jobs.length];
    const assessment = assessments[index % assessments.length];
    const submittedAt = addMinutes(now, -index * 37);
    const invitedAt = addDays(submittedAt, -2);
    const candidateId = new ObjectId();
    const applicationId = new ObjectId();
    const submissionId = new ObjectId();
    let otpCode = createOtpCode();

    while (usedOtpCodes.has(otpCode)) {
      otpCode = createOtpCode();
    }
    usedOtpCodes.add(otpCode);

    const answers = buildSubmissionAnswers(resource, assessment, scenario.correctCount);
    const hasFinalDecision = Boolean(scenario.finalDecision);
    const reviewAction = scenario.finalDecision ?? "evaluated";

    applicationDocs.push({
      _id: applicationId,
      jobId: job._id,
      jobTitle: job.title,
      candidateName: scenario.name,
      candidateEmail: scenario.email,
      cvUrl: `https://drive.google.com/demo-cv-${scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      availability: `${scenario.note} Available for interview within ${index + 1} week(s).`,
      emailStatus: index % 3 === 0 ? "failed" : "sent",
      ...(index % 3 === 0 ? { emailFailure: "Demo mail failure for admin notification testing." } : {}),
      decisionStatus: scenario.applicationDecision,
      ...(scenario.applicationDecision !== "pending"
        ? {
            decisionEmailStatus: index % 4 === 0 ? "failed" : "sent",
            ...(index % 4 === 0 ? { decisionEmailFailure: "Demo decision email failure." } : {}),
            decidedAt: submittedAt,
          }
        : {}),
      createdAt: addMinutes(submittedAt, -90),
      updatedAt: submittedAt,
    });

    candidateDocs.push({
      _id: candidateId,
      name: scenario.name,
      email: scenario.email,
      assessmentId: assessment._id,
      jobId: job._id,
      jobTitle: job.title,
      assessmentIds: [assessment._id],
      otpCode,
      cvUrl: `https://drive.google.com/demo-cv-${scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      invitedAt,
      inviteExpiresAt: addDays(invitedAt, 7),
      inviteEmailStatus: index % 4 === 0 ? "failed" : "sent",
      ...(index % 4 === 0 ? { inviteEmailFailure: "Demo invite email failure; OTP fallback is available." } : {}),
      submittedAt,
    });

    submissionDocs.push({
      _id: submissionId,
      assessmentId: assessment._id,
      assessmentTitle: assessment.name,
      candidateId,
      candidateName: scenario.name,
      candidateEmail: scenario.email,
      submittedAt,
      answeredCount: 10,
      totalQuestions: 10,
      score: scenario.score,
      status: index === 5 ? "Auto submitted" : "Submitted",
      violations: index === 5
        ? [
            {
              id: crypto.randomUUID(),
              sectionSlug: assessment.sectionSettings[0].sectionId,
              sectionTitle: assessment.sectionSettings[0].sectionTitle,
              reason: "Demo focus warning during assessment.",
              occurredAt: addMinutes(submittedAt, -12),
            },
          ]
        : [],
      answers,
      reviews: [
        {
          id: crypto.randomUUID(),
          adminId: admin._id,
          adminName: admin.name ?? "KGM Admin",
          adminEmail: admin.email ?? process.env.ADMIN_EMAIL ?? "admin@example.com",
          action: reviewAction,
          createdAt: addMinutes(submittedAt, 20),
        },
      ],
      evaluatedAt: hasFinalDecision ? addMinutes(submittedAt, 20) : undefined,
      evaluatedBy: hasFinalDecision
        ? {
            adminId: admin._id,
            name: admin.name ?? "KGM Admin",
            email: admin.email ?? process.env.ADMIN_EMAIL ?? "admin@example.com",
          }
        : undefined,
      decision: scenario.finalDecision,
    });

    attemptDocs.push({
      candidateId,
      assessmentId: assessment._id,
      status: "Submitted",
      startedAt: addMinutes(submittedAt, -30),
      updatedAt: submittedAt,
      answers,
      questionStatuses: buildQuestionStatuses(answers),
      questionRemainingSeconds: {},
      sectionDeadlines: {},
      questionDeadlines: {},
      violations: [],
      submittedAt,
    });
  }

  await Promise.all([
    db.collection("candidate_applications").insertMany(applicationDocs),
    db.collection("assessmentCandidates").insertMany(candidateDocs),
    db.collection("assessmentSubmissions").insertMany(submissionDocs),
    db.collection("candidateAssessmentAttempts").insertMany(attemptDocs),
  ]);

  console.log(JSON.stringify({
    database: databaseName,
    preserved: ["adminUsers", "adminSessions", "adminInvitationTokens", "jobs"],
    deleted: [
      "assessments",
      "assessmentCandidates",
      "assessmentSubmissions",
      "candidateAssessmentAttempts",
      "candidate_applications",
    ],
    assessmentsCreated: assessments.map((assessment) => ({
      id: assessment._id.toString(),
      name: assessment.name,
      sections: assessment.sectionSettings.length,
      questions: 10,
      totalMinutes: 30,
    })),
    dummyRecordsCreated: demoScenarios.length,
    scenarios: submissionDocs.map((submission) => ({
      candidate: submission.candidateName,
      job: candidateDocs.find((candidate) => candidate._id.equals(submission.candidateId))?.jobTitle,
      score: submission.score,
      decision: submission.decision ?? "pending review",
      answeredQuestions: Object.keys(submission.answers).length,
    })),
  }, null, 2));
} finally {
  await client.close();
}
