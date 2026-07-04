import { NextResponse } from "next/server";
import {
  saveCandidateAttemptProgress,
  startOrResumeCandidateAttempt,
} from "@/lib/hiring-records";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as {
    candidateId?: string;
    assessmentId?: string;
    sectionDurations?: Record<string, number>;
    questionDurations?: Record<string, number>;
  };

  if (!body.candidateId || !body.assessmentId) {
    return NextResponse.json(
      { message: "Candidate and assessment are required." },
      { status: 400 },
    );
  }

  const attempt = await startOrResumeCandidateAttempt({
    candidateId: body.candidateId,
    assessmentId: body.assessmentId,
    sectionDurations: body.sectionDurations ?? {},
    questionDurations: body.questionDurations ?? {},
  });

  return NextResponse.json({ attempt });
});

export const PATCH = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as {
    candidateId?: string;
    assessmentId?: string;
    answers?: Record<string, string>;
    questionStatuses?: Record<string, "answered" | "skipped" | "unanswered">;
    questionRemainingSeconds?: Record<string, number>;
    questionDeadlines?: Record<string, string>;
    currentSectionSlug?: string;
    currentQuestionId?: string;
    questionDurations?: Record<string, number>;
    violations?: Array<{
      id: string;
      sectionSlug: string;
      sectionTitle: string;
      reason: string;
      occurredAt: string;
    }>;
  };

  if (!body.candidateId || !body.assessmentId) {
    return NextResponse.json(
      { message: "Candidate and assessment are required." },
      { status: 400 },
    );
  }

  const attempt = await saveCandidateAttemptProgress({
    candidateId: body.candidateId,
    assessmentId: body.assessmentId,
    answers: body.answers ?? {},
    questionStatuses: body.questionStatuses ?? {},
    questionRemainingSeconds: body.questionRemainingSeconds,
    questionDeadlines: body.questionDeadlines,
    currentSectionSlug: body.currentSectionSlug,
    currentQuestionId: body.currentQuestionId,
    questionDurations: body.questionDurations,
    violations: body.violations,
  });

  return NextResponse.json({ attempt });
});
