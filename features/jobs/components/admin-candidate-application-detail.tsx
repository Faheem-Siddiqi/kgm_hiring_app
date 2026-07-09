"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MailX,
  Send,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCandidateRecord,
  updateCandidateInviteEmailStatusRecord,
  type Candidate,
} from "@/features/test/admin-storage";

type CandidateApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  cvUrl: string;
  availability: string;
  emailStatus: "pending" | "sent" | "failed";
  emailFailure?: string;
  decisionStatus: "pending" | "invited" | "rejected";
  decisionEmailStatus?: "pending" | "sent" | "failed";
  decisionEmailFailure?: string;
  decidedBy?: {
    name: string;
    email: string;
  };
  decidedAt?: string;
  createdAt: string;
};

type ApplicationResponse = {
  message?: string;
  application?: CandidateApplication;
};

type CandidateInviteResponse = {
  message?: string;
  mail?: { sent?: boolean; reason?: string | null };
};

type ApplicationActionResponse = {
  message?: string;
  application?: CandidateApplication;
  mail?: { sent?: boolean; reason?: string | null };
};

type HiringRecordsResponse = {
  canViewCandidateOtp?: boolean;
  candidates?: Candidate[];
};

const DEFAULT_INVITE_EXPIRY_DAYS = 7;

function defaultInviteExpiryInputValue() {
  return new Date(Date.now() + DEFAULT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function copyText(value: string, message: string) {
  await navigator.clipboard.writeText(value);
  toast.success(message);
}

export function AdminCandidateApplicationDetail({
  applicationId,
}: {
  applicationId: string;
}) {
  const [application, setApplication] = useState<CandidateApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [inviteExpiryDate, setInviteExpiryDate] = useState(defaultInviteExpiryInputValue());
  const [isInviting, setIsInviting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [inviteCandidate, setInviteCandidate] = useState<Candidate | null>(null);
  const [inviteFailedReason, setInviteFailedReason] = useState("");
  const [canViewInviteOtp, setCanViewInviteOtp] = useState(false);

  const loadFailedInviteFallback = useCallback(async (currentApplication: CandidateApplication) => {
    try {
      const response = await fetch("/api/admin/hiring-records?view=analytics", {
        cache: "no-store",
      });
      const payload = (await response.json()) as HiringRecordsResponse;

      if (!response.ok) return;

      const candidate = (payload.candidates ?? []).find((item) => {
        const sameEmail =
          item.email.trim().toLowerCase() ===
          currentApplication.candidateEmail.trim().toLowerCase();
        const sameJob =
          item.jobAssignmentId === currentApplication.jobId ||
          item.jobId === currentApplication.jobId ||
          item.jobTitle === currentApplication.jobTitle;

        return sameEmail && sameJob && item.inviteEmailStatus === "failed";
      });

      if (candidate) {
        setInviteCandidate(candidate);
        setInviteFailedReason(
          candidate.inviteEmailFailure ??
            currentApplication.decisionEmailFailure ??
            "Email could not be sent.",
        );
        setCanViewInviteOtp(payload.canViewCandidateOtp ?? false);
      }
    } catch {
      // The page still remains usable for accept/reject if fallback loading fails.
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadApplication() {
      setIsLoading(true);
      setNotFound(false);

      try {
        const response = await fetch(`/api/admin/candidate-applications/${applicationId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApplicationResponse;

        if (response.status === 404) {
          if (active) {
            setNotFound(true);
            setApplication(null);
          }
          return;
        }

        if (!response.ok || !payload.application) {
          throw new Error(payload.message ?? "Could not load candidate application.");
        }

        if (active) {
          setApplication(payload.application);
          setCandidateEmail(payload.application.candidateEmail);
        }

        if (
          payload.application.decisionStatus === "invited" &&
          payload.application.decisionEmailStatus === "failed"
        ) {
          void loadFailedInviteFallback(payload.application);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load candidate application.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadApplication();

    return () => {
      active = false;
    };
  }, [applicationId, loadFailedInviteFallback]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;

    setIsInviting(true);
    setInviteCandidate(null);
    setInviteFailedReason("");
    setCanViewInviteOtp(false);

    let candidate: Candidate | null = null;

    try {
      const assignment = await createCandidateRecord(
        application.candidateName,
        candidateEmail.trim(),
        application.jobId,
        "job",
        inviteExpiryDate,
      );
      candidate = assignment.candidate;
      setCanViewInviteOtp(assignment.canViewCandidateOtp);

      if (assignment.existingPending) {
        setInviteCandidate(candidate);
        toast.info("This candidate already has an active invite for this job.");
        await markApplicationInvited(true, null);
        return;
      }

      const response = await fetch("/api/admin/candidate-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          assessmentTitle: application.jobTitle,
          inviteExpiresAt: candidate.inviteExpiresAt,
        }),
      });
      const payload = (await response.json()) as CandidateInviteResponse;

      if (!response.ok || !payload.mail?.sent) {
        const reason =
          payload.mail?.reason ?? payload.message ?? "Email could not be sent.";
        await updateCandidateInviteEmailStatusRecord(candidate.id, "failed", reason);
        await markApplicationInvited(false, reason);
        setInviteCandidate(candidate);
        setInviteFailedReason(reason);
        toast.error("Email invite failed. Manual OTP is available below.");
        return;
      }

      await updateCandidateInviteEmailStatusRecord(candidate.id, "sent");
      await markApplicationInvited(true, null);
      setInviteCandidate(candidate);
      setInviteExpiryDate(defaultInviteExpiryInputValue());
      toast.success(`Invite email sent to ${candidate.email}.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not send invite.";
      if (candidate) {
        await updateCandidateInviteEmailStatusRecord(candidate.id, "failed", reason);
        setInviteCandidate(candidate);
        setInviteFailedReason(reason);
      }
      toast.error(reason);
    } finally {
      setIsInviting(false);
    }
  }

  async function markApplicationInvited(mailSent: boolean, mailReason: string | null) {
    if (!application) return;

    const response = await fetch(`/api/admin/candidate-applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "invite",
        mailSent,
        mailReason,
      }),
    });
    const payload = (await response.json()) as ApplicationActionResponse;

    if (response.ok && payload.application) {
      setApplication(payload.application);
    }
  }

  async function handleReject() {
    if (!application) return;

    setIsRejecting(true);

    try {
      const response = await fetch(`/api/admin/candidate-applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const payload = (await response.json()) as ApplicationActionResponse;

      if (!response.ok || !payload.application) {
        throw new Error(payload.message ?? "Could not reject candidate application.");
      }

      setApplication(payload.application);

      if (payload.mail?.sent === false) {
        toast.warning(payload.message ?? "Application rejected, but email failed.");
      } else {
        toast.success(payload.message ?? "Rejection email sent to the candidate.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not reject candidate application.",
      );
    } finally {
      setIsRejecting(false);
    }
  }

  function buildCandidateLink(candidate: Candidate) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/assessment/verify?otp=${candidate.otpCode}`;
  }

  if (isLoading) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AdminNavbar />
        <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="h-80 animate-pulse rounded-lg border bg-muted/20" />
            <div className="h-80 animate-pulse rounded-lg border bg-muted/20" />
          </div>
        </section>
      </main>
    );
  }

  if (notFound || !application) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AdminNavbar />
        <section className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-4 py-10">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Application not found</CardTitle>
              <CardDescription>
                The candidate application link is invalid or no longer available.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <Button asChild variant="outline">
                <Link href="/admin/candidate-applications">
                  <ArrowLeft className="size-4" />
                  Back to applications
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const isDecisionFinal = application.decisionStatus !== "pending";
  const decisionDescription =
    application.decisionStatus === "invited"
      ? "This application has already been accepted for an assessment invite."
      : application.decisionStatus === "rejected"
        ? "This application has already been rejected."
        : "Accept the application by sending an assessment invite, or send a rejection email.";
  const decisionActionLabel =
    application.decisionStatus === "invited"
      ? "accepted"
      : application.decisionStatus === "rejected"
        ? "rejected"
        : "";
  const decisionAdminName = application.decidedBy?.name?.trim();
  const decisionAdminEmail = application.decidedBy?.email?.trim();

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/candidate-applications">
            <ArrowLeft className="size-4" />
            Back to applications
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <Card>
            <CardHeader>
             
              <CardTitle className="text-2xl">{application.candidateName}</CardTitle>
              <CardDescription>
                Submitted for {application.jobTitle} on {formatDate(application.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRound className="size-3.5" />
                    Candidate
                  </div>
                  <p className="mt-2 font-medium">{application.candidateName}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {application.candidateEmail}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    Notification
                  </div>
                  <p className="mt-2 font-medium capitalize">{application.emailStatus}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Decision: {application.decisionStatus}
                  </p>
                </div>
              </div>

              {/* {application.decisionEmailStatus === "failed" ? (
                <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    Candidate decision email failed.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {application.decisionEmailFailure ?? "No failure reason was recorded."}
                  </p>
                </div>
              ) : null} */}

              {/* {application.emailStatus === "failed" ? (
                <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    Admin email notification failed.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    The email could not be delivered to the admins.
                  </p>
                </div>
              ) : null} */}

              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">CV link</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline" size="sm">
                    <a href={application.cvUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Open CV
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText(application.cvUrl, "CV link copied")}
                  >
                    <Copy className="size-4" />
                    Copy CV link
                  </Button>
                </div>
                <p className="mt-3 break-all text-xs text-muted-foreground">
                  {application.cvUrl}
                </p>
              </div>

              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">Availability</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {application.availability}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application decision</CardTitle>
              <CardDescription>
                {decisionDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isDecisionFinal ? (
                <div className="mb-4 rounded-md border bg-muted/20 p-3 text-sm">
                  <p className="font-medium capitalize">
                    Application {decisionActionLabel}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {decisionAdminName
                      ? `${decisionAdminName} ${decisionActionLabel} this application${
                          application.decidedAt ? ` on ${formatDate(application.decidedAt)}` : ""
                        }.`
                      : `This application was ${decisionActionLabel}, but the admin name was not recorded.`}
                  </p>
                  {decisionAdminEmail ? (
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {decisionAdminEmail}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleInvite}>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Candidate name</Label>
                  <Input id="invite-name" value={application.candidateName} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Candidate email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    value={candidateEmail}
                    onChange={(event) => setCandidateEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-expiry">Invite expiry</Label>
                  <Input
                    id="invite-expiry"
                    type="date"
                    className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    value={inviteExpiryDate}
                    onChange={(event) => setInviteExpiryDate(event.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={isInviting || isRejecting || isDecisionFinal}
                  type="submit"
                >
                  {isInviting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {isInviting ? "Sending invite..." : "Accept and send assessment invite"}
                </Button>
              </form>

              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isInviting || isRejecting || isDecisionFinal}
                onClick={() => void handleReject()}
              >
                {isRejecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MailX className="size-4" />
                )}
                {isRejecting ? "Sending rejection..." : "Reject and email candidate"}
              </Button>

              {inviteCandidate ? (
                <div className="mt-4 rounded-md border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Mail className="size-4" />
                    Invite record created
                  </div>
                  {inviteFailedReason ? (
                    <p className="mt-2 text-xs text-destructive">{inviteFailedReason}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Manual OTP remains available according to the existing OTP visibility rules.
                  </p>
                  {inviteFailedReason ? (
                    <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 p-3">
                      <p className="text-xs font-medium text-destructive">
                        Email failed. Share this OTP manually.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        OTP is visible to HOD and IT personnel only.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canViewInviteOtp ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText(inviteCandidate.otpCode, "OTP copied")}
                            >
                              <Copy className="size-4" />
                              Copy OTP {inviteCandidate.otpCode}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void copyText(
                                  buildCandidateLink(inviteCandidate),
                                  "Candidate assessment link copied",
                                )
                              }
                            >
                              <Copy className="size-4" />
                              Copy invite link
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="border-destructive/30 bg-background text-destructive">
                            OTP ******
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
