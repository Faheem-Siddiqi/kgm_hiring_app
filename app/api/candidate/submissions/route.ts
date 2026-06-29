import { NextResponse } from "next/server";
import { createCandidateSubmission } from "@/lib/hiring-records";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as {
    candidateId?: string;
    assessmentId?: string;
    assessmentTitle?: string;
    answers?: Record<string, string>;
    answeredCount?: number;
    totalQuestions?: number;
    score?: number;
    status?: "Submitted" | "Auto submitted";
    violations?: Array<{
      id: string;
      sectionSlug: string;
      sectionTitle: string;
      reason: string;
      occurredAt: string;
    }>;
  };

  if (!body.candidateId || !body.assessmentId || !body.assessmentTitle) {
    return NextResponse.json(
      { message: "Candidate, assessment, and title are required." },
      { status: 400 },
    );
  }

  const submission = await createCandidateSubmission({
    candidateId: body.candidateId,
    assessmentId: body.assessmentId,
    assessmentTitle: body.assessmentTitle,
    answers: body.answers ?? {},
    answeredCount: Math.max(0, Math.round(Number(body.answeredCount ?? 0))),
    totalQuestions: Math.max(0, Math.round(Number(body.totalQuestions ?? 0))),
    score: Math.max(0, Math.min(100, Math.round(Number(body.score ?? 0)))),
    status: body.status ?? "Submitted",
    violations: body.violations ?? [],
  });

  return NextResponse.json({ submission });
});
