import { NextResponse } from "next/server";
import {
  createCandidateApplication,
  updateCandidateApplicationEmailStatus,
} from "@/lib/job-applications";
import { sendCandidateApplicationEmail } from "@/lib/mail/candidate-application-mailer";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

function buildApplicationUrl(request: Request, applicationId: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/admin/application-review/${applicationId}`;
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as {
    jobId?: string;
    candidateName?: string;
    candidateEmail?: string;
    cvUrl?: string;
    availability?: string;
  };

  const application = await createCandidateApplication({
    jobId: body.jobId?.trim() ?? "",
    candidateName: body.candidateName?.trim() ?? "",
    candidateEmail: body.candidateEmail?.trim() ?? "",
    cvUrl: body.cvUrl?.trim() ?? "",
    availability: body.availability?.trim() ?? "",
  });
  const submissionUrl = buildApplicationUrl(request, application.id);
  const mail = await sendCandidateApplicationEmail({
    application,
    submissionUrl,
  });
  const savedApplication = await updateCandidateApplicationEmailStatus(
    application.id,
    mail.sent ? "sent" : "failed",
    mail.reason,
  );

  return NextResponse.json(
    {
      application: savedApplication ?? application,
      mail,
      message: mail.sent
        ? "Application submitted. The hiring team has been notified."
        : "Application submitted. Email notification could not be sent.",
    },
    { status: 201 },
  );
});
