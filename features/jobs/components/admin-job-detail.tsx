"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BarChart3, CheckCircle2, ClipboardList, Clock3, Copy, Loader2, Save, Search, Send, ShieldAlert, Target, TimerReset, Trophy, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCandidateRecord,
  fetchAdminDataSnapshot,
  readAdminDataSnapshot,
  subscribeToAdminData,
  updateCandidateInviteEmailStatusRecord,
  upsertJobAssessment,
  type AssessmentResult,
  type Candidate,
} from "@/features/test/admin-storage";
import {
  JOB_EXPERIENCE_LEVELS,
  JOB_LOCATIONS,
  JOB_STATUSES,
  type JobAssessmentOption,
  type PublicJob,
} from "@/lib/job-types";

type AdminSnapshot = {
  candidates?: Candidate[];
  results?: AssessmentResult[];
  canViewCandidateOtp?: boolean;
};

type CandidateInviteResponse = {
  message?: string;
  mail?: { sent?: boolean; reason?: string | null };
};

const CANDIDATES_PER_PAGE = 8;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;

function defaultInviteExpiryInputValue() {
  return new Date(Date.now() + DEFAULT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function parseAdminSnapshot(snapshot: string) {
  try {
    return JSON.parse(snapshot) as AdminSnapshot;
  } catch {
    return {};
  }
}

function useAdminData() {
  const [data, setData] = useState<AdminSnapshot>({});
  const [isLoading, setIsLoading] = useState(true);
  const localSnapshot = useSyncExternalStore(
    subscribeToAdminData,
    readAdminDataSnapshot,
    () => "{}",
  );
  const loadData = useCallback(async () => {
    const snapshot = await fetchAdminDataSnapshot({ view: "analytics" });
    setData({
      candidates: snapshot.candidates,
      results: snapshot.results,
      canViewCandidateOtp: snapshot.canViewCandidateOtp,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const snapshot = await fetchAdminDataSnapshot({ view: "analytics" });
        if (active) {
          setData({
            candidates: snapshot.candidates,
            results: snapshot.results,
            canViewCandidateOtp: snapshot.canViewCandidateOtp,
          });
          setIsLoading(false);
        }
      } catch (error) {
        if (active) setIsLoading(false);
        toast.error(error instanceof Error ? error.message : "Could not load candidates.");
      }
    }

    void loadInitialData();
    const interval = window.setInterval(() => {
      void loadInitialData();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const localData = parseAdminSnapshot(localSnapshot);
  const candidates = data.candidates?.length ? data.candidates : localData.candidates ?? [];
  const results = data.results?.length ? data.results : localData.results ?? [];
  const canViewCandidateOtp = data.canViewCandidateOtp ?? localData.canViewCandidateOtp ?? false;

  return { candidates, results, canViewCandidateOtp, isLoading, refresh: loadData };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function splitList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function runtimeAssessmentFromJob(job: PublicJob, assessment: JobAssessmentOption) {
  return {
    id: assessment.id,
    title: `${job.title} - ${assessment.name}`,
    role: assessment.questionBankName,
    createdAt: job.createdAt,
    resourceId: assessment.questionBankId,
    sectionCount: 3,
    timePerSectionMinutes: 15,
    questionsPerTest: 20,
    questionsPerSection: 20,
  };
}

type StatItem = {
  label: string;
  value: string | number;
  icon: LucideIcon;
};

function JobScoreDistributionSkeleton() {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
          <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid h-48 grid-cols-4 items-end gap-3 rounded-md bg-muted/20 p-3">
        {[35, 52, 74, 90].map((height, index) => (
          <div key={index} className="flex h-full flex-col justify-end gap-2">
            <div className="flex min-h-0 flex-1 items-end">
              <div
                className="w-full animate-pulse rounded-t-md bg-muted"
                style={{ height: `${height}%` }}
              />
            </div>
            <div className="mx-auto h-4 w-8 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-3 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}

function TopCandidatesSkeleton() {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="size-9 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 max-w-full animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-14 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminJobDetail({
  job,
  assessments,
  mode = "overview",
}: {
  job: PublicJob;
  assessments: JobAssessmentOption[];
  mode?: "overview" | "configure";
}) {
  const [title, setTitle] = useState(job.title);
  const [department, setDepartment] = useState(job.department);
  const [location, setLocation] = useState(job.location);
  const [experience, setExperience] = useState(job.experience);
  const [description, setDescription] = useState(job.description);
  const [responsibilities, setResponsibilities] = useState(job.responsibilities.join("\n"));
  const [requirements, setRequirements] = useState(job.requirements.join("\n"));
  const [assessmentIds, setAssessmentIds] = useState(job.assessmentIds.slice(0, 1));
  const [currentStatus, setCurrentStatus] = useState(job.status);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [inviteExpiryDate, setInviteExpiryDate] = useState(defaultInviteExpiryInputValue);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateEvaluationFilter, setCandidateEvaluationFilter] = useState<"all" | "evaluated" | "non-evaluated">("all");
  const [candidatePage, setCandidatePage] = useState(1);
  const [existingInvite, setExistingInvite] = useState<{
    candidate: Candidate;
    assessmentTitle: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [resendingExistingInvite, setResendingExistingInvite] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reopeningJob, setReopeningJob] = useState(false);
  const [activeScoreBucket, setActiveScoreBucket] = useState("80-100");
  const { candidates, results, canViewCandidateOtp, isLoading, refresh } = useAdminData();
  const jobCandidates = useMemo(
    () =>
      candidates.filter((candidate) =>
        candidate.jobAssignmentId === job.id ||
        job.assessmentIds.includes(candidate.jobId) ||
        candidate.assessmentIds?.some((id) => job.assessmentIds.includes(id)),
      ),
    [candidates, job.id, job.assessmentIds],
  );
  const jobResults = useMemo(
    () => results.filter((result) => job.assessmentIds.includes(result.assessmentId)),
    [job.assessmentIds, results],
  );
  const expectedSubmissions = jobCandidates.reduce(
    (total, candidate) =>
      total + (candidate.assessmentIds?.filter((id) => job.assessmentIds.includes(id)).length || 1),
    0,
  );
  const completionRate = expectedSubmissions
    ? Math.round((jobResults.length / expectedSubmissions) * 100)
    : 0;
  const activeInvites = jobCandidates.filter(
    (candidate) => !candidate.submittedAt && !candidate.isInviteExpired,
  ).length;
  const expiredInvites = jobCandidates.filter(
    (candidate) => !candidate.submittedAt && candidate.isInviteExpired,
  ).length;
  const pendingSubmissions = Math.max(0, expectedSubmissions - jobResults.length);
  const averageScore = jobResults.length
    ? Math.round(jobResults.reduce((total, result) => total + result.score, 0) / jobResults.length)
    : 0;
  const pendingReview = jobResults.filter((result) => !result.decision && !result.evaluatedAt).length;
  const autoSubmitted = jobResults.filter((result) => result.status === "Auto submitted").length;
  const violationCount = jobResults.reduce((total, result) => total + result.violations.length, 0);
  const evaluatedCount = jobResults.filter((result) => result.evaluatedAt || result.decision).length;
  const scoreBuckets = [
    {
      label: "0-39",
      tone: "Needs review",
      count: jobResults.filter((result) => result.score < 40).length,
    },
    {
      label: "40-59",
      tone: "Developing",
      count: jobResults.filter((result) => result.score >= 40 && result.score < 60).length,
    },
    {
      label: "60-79",
      tone: "Qualified",
      count: jobResults.filter((result) => result.score >= 60 && result.score < 80).length,
    },
    {
      label: "80-100",
      tone: "Strong",
      count: jobResults.filter((result) => result.score >= 80).length,
    },
  ];
  const maxScoreBucket = Math.max(1, ...scoreBuckets.map((bucket) => bucket.count));
  const selectedScoreBucket =
    scoreBuckets.find((bucket) => bucket.label === activeScoreBucket) ?? scoreBuckets[3];
  const topPerformingCandidates = useMemo(
    () =>
      [...jobResults]
        .sort(
          (first, second) =>
            second.score - first.score ||
            new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime(),
        )
        .slice(0, 3),
    [jobResults],
  );
  const filteredJobCandidates = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase();

    return jobCandidates.filter((candidate) => {
      const candidateAssessmentIds = candidate.assessmentIds?.length
        ? candidate.assessmentIds.filter((id) => job.assessmentIds.includes(id))
        : [candidate.jobId];
      const candidateResults = jobResults.filter((item) =>
        item.candidateId
          ? item.candidateId === candidate.id
          : item.candidateEmail === candidate.email && candidateAssessmentIds.includes(item.assessmentId),
      );
      const isEvaluated = candidateResults.some((result) => result.evaluatedAt || result.decision);

      if (candidateEvaluationFilter === "evaluated" && !isEvaluated) return false;
      if (candidateEvaluationFilter === "non-evaluated" && isEvaluated) return false;
      if (!query) return true;

      const candidateAssessments = job.assessments.filter((item) =>
        candidateAssessmentIds.includes(item.id),
      );

      return [
        candidate.name,
        candidate.email,
        candidate.inviteEmailStatus ?? "sent",
        candidate.jobTitle ?? "",
        ...candidateAssessments.flatMap((assessment) => [assessment.code, assessment.name]),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [candidateEvaluationFilter, candidateSearch, job.assessmentIds, job.assessments, jobCandidates, jobResults]);
  const totalCandidatePages = Math.max(
    1,
    Math.ceil(filteredJobCandidates.length / CANDIDATES_PER_PAGE),
  );
  const currentCandidatePage = Math.min(candidatePage, totalCandidatePages);
  const paginatedCandidates = filteredJobCandidates.slice(
    (currentCandidatePage - 1) * CANDIDATES_PER_PAGE,
    currentCandidatePage * CANDIDATES_PER_PAGE,
  );
  const stats: StatItem[] = [
    { label: "Candidates", value: jobCandidates.length, icon: Users },
    { label: "Completed", value: `${completionRate}%`, icon: CheckCircle2 },
    { label: "Assessments", value: job.assessments.length, icon: ClipboardList },
    { label: "Status", value: currentStatus, icon: ClipboardList },
  ];

  function buildCandidateLink(candidate: Candidate) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/assessment/verify?otp=${candidate.otpCode}`;
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Copy failed. Select the text and copy it manually.");
    }
  }

  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assessmentIds.length !== 1) {
      toast.error("Select one assessment before saving the job.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/admin/jobs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        title,
        department,
        location,
        experience,
        status: currentStatus,
        summary: description,
        description,
        responsibilities: splitList(responsibilities),
        requirements: splitList(requirements),
        tags: job.tags,
        assessmentIds,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setSaving(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not update job.");
      return;
    }

    toast.success("Job updated.");
  }

  async function sendCandidateInviteByRecord(candidate: Candidate, assessmentTitle: string) {
    let response: Response;
    let payload: CandidateInviteResponse;

    try {
      response = await fetch("/api/admin/candidate-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          assessmentTitle,
          inviteExpiresAt: candidate.inviteExpiresAt,
        }),
      });
      payload = (await response.json()) as CandidateInviteResponse;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not reach the mail service.";
      await updateCandidateInviteEmailStatusRecord(candidate.id, "failed", reason);
      await refresh();
      toast.error("Email Invite failed. Manual OTP record is available in the candidates table.");
      return false;
    }

    if (!response.ok || !payload.mail?.sent) {
      const reason = payload.mail?.reason ?? payload.message ?? "Email could not be sent.";
      await updateCandidateInviteEmailStatusRecord(candidate.id, "failed", reason);
      await refresh();
      toast.error("Email Invite failed. Manual OTP record is available in the candidates table.");
      return false;
    }

    await updateCandidateInviteEmailStatusRecord(candidate.id, "sent");
    await refresh();
    toast.success(`Invite email sent to ${candidate.email}.`);
    return true;
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStatus === "closed" || currentStatus === "paused") {
      toast.error(`This job is ${currentStatus}. Reopen the job before inviting candidates.`);
      setStatusModalOpen(true);
      return;
    }

    if (!candidateName.trim() || !candidateEmail.trim() || !job.assessments.length) {
      toast.error("Candidate name, email, and at least one job assessment are required.");
      return;
    }

    job.assessments.forEach((assessment) => {
      upsertJobAssessment(runtimeAssessmentFromJob(job, assessment));
    });
    setSendingInvite(true);
    let response: Response;
    let payload: CandidateInviteResponse;
    let candidate: Candidate | null = null;

    try {
      const assignment = await createCandidateRecord(
        candidateName.trim(),
        candidateEmail.trim(),
        job.id,
        "job",
        inviteExpiryDate,
      );
      candidate = assignment.candidate;

      if (assignment.existingPending) {
        setExistingInvite({
          candidate,
          assessmentTitle: job.title,
        });
        await refresh();
        setSendingInvite(false);
        return;
      }

      response = await fetch("/api/admin/candidate-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          assessmentTitle: job.title,
          inviteExpiresAt: candidate.inviteExpiresAt,
        }),
      });
      payload = (await response.json()) as CandidateInviteResponse;
    } catch (error) {
      if (candidate) {
        try {
          await updateCandidateInviteEmailStatusRecord(
            candidate.id,
            "failed",
            error instanceof Error ? error.message : "Email could not be sent.",
          );
        } finally {
          await refresh();
        }
      }
      setSendingInvite(false);
      toast.error(error instanceof Error ? error.message : "Email Invite failed. Manual OTP record is available in the candidates table.");
      return;
    }

    setSendingInvite(false);

    if (!response.ok || !payload.mail?.sent) {
      await updateCandidateInviteEmailStatusRecord(
        candidate.id,
        "failed",
        payload.mail?.reason ?? payload.message ?? "Email could not be sent.",
      );
      await refresh();
      toast.error("Email Invite failed. Manual OTP record is available in the candidates table.");
      return;
    }

    await updateCandidateInviteEmailStatusRecord(candidate.id, "sent");
    await refresh();
    setCandidateName("");
    setCandidateEmail("");
    setInviteExpiryDate(defaultInviteExpiryInputValue());
    setCandidateSearch("");
    setCandidatePage(1);
    toast.success(`Invite email sent to ${candidate.email}.`);
  }

  async function resendExistingInvite() {
    if (!existingInvite) return;

    setResendingExistingInvite(true);
    const sent = await sendCandidateInviteByRecord(
      existingInvite.candidate,
      existingInvite.assessmentTitle,
    );
    setResendingExistingInvite(false);

    if (sent) {
      setExistingInvite(null);
      setCandidateName("");
      setCandidateEmail("");
      setInviteExpiryDate(defaultInviteExpiryInputValue());
    }
  }

  async function reopenJobFromModal() {
    setReopeningJob(true);
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, status: "reopened" }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Could not reopen job.");
      }

      setCurrentStatus("reopened");
      setStatusModalOpen(false);
      toast.success("Job reopened. You can invite candidates now.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reopen job.");
    } finally {
      setReopeningJob(false);
    }
  }

  async function changeJobStatus(status: typeof currentStatus) {
    if (status === currentStatus || updatingStatus) return;

    const previousStatus = currentStatus;
    setCurrentStatus(status);
    setUpdatingStatus(true);

    try {
      const response = await fetch("/api/admin/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, status }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Could not update job status.");
      }

      toast.success(`Job status changed to ${status}.`);
    } catch (error) {
      setCurrentStatus(previousStatus);
      toast.error(error instanceof Error ? error.message : "Could not update job status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <Dialog open={statusModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Job is not open</DialogTitle>
            <DialogDescription>
              This job is currently {currentStatus}. Reopen the job before sending
              candidate invitations for its assessments.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/20 p-4 text-sm">
            Candidate invites are blocked while a job is paused or closed.
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={reopeningJob}
              onClick={() => setStatusModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={reopeningJob}
              onClick={() => void reopenJobFromModal()}
            >
              {reopeningJob ? <Loader2 className="size-4 animate-spin" /> : null}
              Reopen job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(existingInvite)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Existing active invitation</DialogTitle>
            <DialogDescription>
              This candidate already has an active invitation for this job.
              A new assignment was not created. You can resend the email using the
              existing invitation.
            </DialogDescription>
          </DialogHeader>
          {existingInvite ? (
            <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Candidate</span>
                <span className="font-medium">{existingInvite.candidate.name}</span>
                <span className="text-muted-foreground">{existingInvite.candidate.email}</span>
              </div>
              <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                OTP is reused from the active invitation and is not shown here.
                If email fails, manual OTP visibility is limited to HOD and IT
                personnel only.
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Expires</span>
                <p className="font-medium">{formatDate(existingInvite.candidate.inviteExpiresAt)}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={resendingExistingInvite}
              onClick={() => setExistingInvite(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={resendingExistingInvite}
              onClick={() => void resendExistingInvite()}
            >
              {resendingExistingInvite ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {resendingExistingInvite ? "Sending" : "Send email invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{currentStatus}</Badge>
                <span className="text-xs text-muted-foreground">{job.department} / {job.location}</span>
              </div>
              <h1 className="truncate text-2xl font-semibold tracking-tight">{job.title}</h1>
              <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
              <Label htmlFor="quick-job-status" className="text-sm  text-muted-foreground">
                Status |
              </Label>
              <select
                id="quick-job-status"
                className="h-7 bg-transparent text-sm capitalize outline-none disabled:opacity-60"
                value={currentStatus}
                disabled={updatingStatus}
                onChange={(event) => void changeJobStatus(event.target.value as typeof currentStatus)}
              >
                {JOB_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {updatingStatus ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>
            {mode === "configure" ? (
              <Button asChild variant="outline">
                <Link href={`/admin/jobs/${job.slug}`}>Back to analytics</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/admin/jobs/${job.slug}/configure`}>
                  {/* <Save className="size-4" /> */}
                  Configure job
                </Link>
              </Button>
            )}
           
          </div>
        </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <Icon className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold capitalize">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          {mode === "configure" ? (
          <Card>
            <CardHeader>
              <CardTitle>Configure job</CardTitle>
              <CardDescription>Update the public job detail and assigned assessments.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveJob}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="job-title">Title</Label>
                    <Input id="job-title" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-department">Department</Label>
                    <Input id="job-department" value={department} onChange={(event) => setDepartment(event.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="job-location">Location</Label>
                    <select id="job-location" className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none" value={location} onChange={(event) => setLocation(event.target.value as typeof location)}>
                      {JOB_LOCATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-experience">Experience</Label>
                    <select id="job-experience" className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none" value={experience} onChange={(event) => setExperience(event.target.value as typeof experience)}>
                      {JOB_EXPERIENCE_LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-status">Status</Label>
                  <select
                    id="job-status"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm capitalize shadow-xs outline-none"
                    value={currentStatus}
                    onChange={(event) => setCurrentStatus(event.target.value as typeof currentStatus)}
                  >
                    {JOB_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Paused and closed jobs block new candidate invitations until reopened.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-description">Description</Label>
                  <Textarea id="job-description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="job-responsibilities">Responsibilities</Label>
                    <Textarea id="job-responsibilities" value={responsibilities} onChange={(event) => setResponsibilities(event.target.value)} className="min-h-32" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-requirements">Requirements</Label>
                    <Textarea id="job-requirements" value={requirements} onChange={(event) => setRequirements(event.target.value)} className="min-h-32" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assessments</Label>
                  <div className="grid gap-2">
                    {assessments.map((assessment) => (
                      <label key={assessment.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                        <input
                          type="radio"
                          name="job-detail-assessment"
                          className="mt-1 size-4 accent-primary"
                          checked={assessmentIds.includes(assessment.id)}
                          onChange={() => setAssessmentIds([assessment.id])}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{assessment.code} · {assessment.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{assessment.questionBankName}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={saving}>
                  <Save className="size-4" />
                  Save job
                </Button>
              </form>
            </CardContent>
          </Card>
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Job analytics</CardTitle>
              <CardDescription>
                Useful signals for this job invitation, assessment, and review flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="rounded-md border p-4">
                        <div className="mb-3 size-4 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                        <div className="mt-3 h-7 w-16 animate-pulse rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                  <JobScoreDistributionSkeleton />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Expected submissions", value: expectedSubmissions, icon: Target },
                      { label: "Pending submissions", value: pendingSubmissions, icon: Clock3 },
                      { label: "Average score", value: `${averageScore}%`, icon: BarChart3 },
                      { label: "Pending review", value: pendingReview, icon: ClipboardList },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-md border p-4 transition hover:bg-muted/30">
                        <Icon className="mb-3 size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-2xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Completion progress</span>
                      <span className="text-muted-foreground">{jobResults.length}/{expectedSubmissions || 0}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${completionRate}%` }} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="font-semibold">{activeInvites}</p>
                      <p className="text-xs text-muted-foreground">Active invites</p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="font-semibold">{expiredInvites}</p>
                      <p className="text-xs text-muted-foreground">Expired invites</p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="font-semibold">{evaluatedCount}</p>
                      <p className="text-xs text-muted-foreground">Evaluated</p>
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Interactive score distribution</p>
                        <p className="text-xs text-muted-foreground">
                          Hover or click a score band to inspect candidate quality.
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-right">
                        <p className="text-xs text-muted-foreground">{selectedScoreBucket.label}% band</p>
                        <p className="text-lg font-semibold">{selectedScoreBucket.count} candidates</p>
                        <p className="text-xs text-muted-foreground">{selectedScoreBucket.tone}</p>
                      </div>
                    </div>
                    <div className="grid h-48 grid-cols-4 items-end gap-3 rounded-md bg-muted/20 p-3">
                      {scoreBuckets.map((bucket) => {
                        const active = selectedScoreBucket.label === bucket.label;
                        return (
                          <button
                            key={bucket.label}
                            type="button"
                            onMouseEnter={() => setActiveScoreBucket(bucket.label)}
                            onFocus={() => setActiveScoreBucket(bucket.label)}
                            onClick={() => setActiveScoreBucket(bucket.label)}
                            className="group flex h-full flex-col justify-end gap-2 rounded-md outline-none"
                            aria-label={`${bucket.count} candidates scored ${bucket.label} percent`}
                          >
                            <div className="flex min-h-0 flex-1 items-end">
                              <div
                                className={`relative w-full rounded-t-md transition-all duration-300 ${
                                  active
                                    ? "bg-foreground shadow-lg shadow-foreground/15"
                                    : "bg-foreground/45 group-hover:bg-foreground/75"
                                }`}
                                style={{
                                  height: `${bucket.count ? Math.max(14, (bucket.count / maxScoreBucket) * 100) : 5}%`,
                                }}
                              >
                                <span className="absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-xs shadow-sm group-hover:block group-focus:block">
                                  {bucket.count} in {bucket.label}%
                                </span>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium">{bucket.count}</p>
                              <p className="text-xs text-muted-foreground">{bucket.label}%</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                      {scoreBuckets.map((bucket) => (
                        <button
                          key={bucket.label}
                          type="button"
                          onClick={() => setActiveScoreBucket(bucket.label)}
                          className={`rounded-md border px-3 py-2 text-left transition ${
                            selectedScoreBucket.label === bucket.label
                              ? "border-foreground bg-foreground text-background"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <span className="block font-medium">{bucket.label}%</span>
                          <span>{bucket.tone}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border p-4">
                      <ShieldAlert className="mb-3 size-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Integrity violations</p>
                      <p className="mt-1 text-2xl font-semibold">{violationCount}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <TimerReset className="mb-3 size-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Auto-submitted</p>
                      <p className="mt-1 text-2xl font-semibold">{autoSubmitted}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          )}

          <div className="space-y-6">
            {mode === "overview" ? (
            <Card>
              <CardHeader>
                <CardTitle>Invite candidate</CardTitle>
                <CardDescription>One invitation opens every assessment assigned to this job.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={sendInvite}>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="candidate-name">Candidate name</Label>
                      <Input id="candidate-name" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="candidate-email">Email</Label>
                      <Input id="candidate-email" type="email" value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2 ">
                    <Label htmlFor="invite-expiry">Invitation expiry</Label>
                    <Input
    id="invite-expiry"
    type="date"
    value={inviteExpiryDate}
    min={new Date().toISOString().slice(0, 10)}
    onChange={(event) => setInviteExpiryDate(event.target.value)}
    className="
      relative w-full pr-10
      [&::-webkit-calendar-picker-indicator]:absolute
      [&::-webkit-calendar-picker-indicator]:right-3
      [&::-webkit-calendar-picker-indicator]:top-1/2
      [&::-webkit-calendar-picker-indicator]:-translate-y-1/2
      [&::-webkit-calendar-picker-indicator]:cursor-pointer
    "
  />
                  </div>
                  <Button type="submit" className="w-full" disabled={!job.assessments.length || sendingInvite}>
                    {sendingInvite ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {sendingInvite ? "Sending invite" : "Send invite"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Assigned assessments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {job.assessments.map((assessment) => (
                  <Button key={assessment.id} asChild variant="outline" className="h-auto w-full justify-start p-3">
                    <Link href={`/admin/assessment/${assessment.id}`}>
                      <span className="min-w-0 text-left">
                        <span className="block truncate font-medium">{assessment.code} · {assessment.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{assessment.questionBankName}</span>
                      </span>
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Top candidates</CardTitle>
                    <CardDescription>Best three submitted scores for this job.</CardDescription>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-2">
                    <Trophy className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <TopCandidatesSkeleton />
                ) : topPerformingCandidates.length ? (
                  <div className="space-y-3">
                    {topPerformingCandidates.map((result, index) => (
                      <Link
                        key={result.id}
                        href={`/admin/submissions/${result.id}`}
                        className="block rounded-md border bg-muted/20 p-3 transition hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {index + 1}. {result.candidateName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {result.candidateEmail}
                            </p>
                          </div>
                          <Badge variant="secondary">{result.score}%</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Submitted {formatDate(result.submittedAt)}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                    No submitted scores yet. The best performing candidates will appear here after submissions arrive.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {mode === "overview" ? (
        <Card className="flex min-h-[560px] flex-col">
          <CardHeader>
            <CardTitle>Candidates for this job</CardTitle>
            <CardDescription>Open candidate assessment detail when a submission exists.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={candidateSearch}
                  onChange={(event) => {
                    setCandidateSearch(event.target.value);
                    setCandidatePage(1);
                  }}
                  className="pl-9 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  placeholder="Search candidate, email, or assessment"
                  aria-label="Search candidates"
                />
              </div>

              <div className="flex w-full rounded-md border bg-muted/20 p-1 sm:w-auto" aria-label="Filter candidates by evaluation status">
                {[
                  { label: "All", value: "all" },
                  { label: "Evaluated", value: "evaluated" },
                  { label: "Non-evaluated", value: "non-evaluated" },
                ].map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    size="sm"
                    variant={candidateEvaluationFilter === item.value ? "secondary" : "ghost"}
                    className="h-8 flex-1 rounded-sm px-3 text-xs sm:flex-none"
                    onClick={() => {
                      setCandidateEvaluationFilter(item.value as "all" | "evaluated" | "non-evaluated");
                      setCandidatePage(1);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Candidate</th>
                      <th className="px-4 py-3 font-medium">Assessment</th>
                      <th className="px-4 py-3 font-medium">Invite</th>
                      <th className="px-4 py-3 font-medium">Expiry</th>
                      <th className="px-4 py-3 font-medium">Result</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading
                      ? Array.from({ length: 5 }).map((_, index) => (
                          <tr key={`candidate-skeleton-${index}`} className="bg-background">
                            {Array.from({ length: 6 }).map((__, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-4">
                                <div className="h-4 w-full max-w-36 animate-pulse rounded bg-muted" />
                                {cellIndex === 0 ? (
                                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
                                ) : null}
                              </td>
                            ))}
                          </tr>
                        ))
                      : paginatedCandidates.map((candidate) => {
                      const candidateAssessmentIds = candidate.assessmentIds?.length
                        ? candidate.assessmentIds.filter((id) => job.assessmentIds.includes(id))
                        : [candidate.jobId];
                      const candidateResults = jobResults.filter((item) =>
                        item.candidateId
                          ? item.candidateId === candidate.id
                          : item.candidateEmail === candidate.email && candidateAssessmentIds.includes(item.assessmentId),
                      );
                      const latestResult = candidateResults[0];
                      const pendingAssessmentId =
                        candidateAssessmentIds.find(
                          (id) => !candidateResults.some((result) => result.assessmentId === id),
                        ) ?? candidateAssessmentIds[0];
                      const candidateAssessments = job.assessments.filter((item) =>
                        candidateAssessmentIds.includes(item.id),
                      );
                      const emailFailed = candidate.inviteEmailStatus === "failed";

                      return (
                        <tr key={candidate.id} className="bg-background align-top transition hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium">{candidate.name}</p>
                            <p className="break-all text-xs text-muted-foreground">{candidate.email}</p>

                            {emailFailed ? (
                              <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 p-3">
                                <p className="text-xs font-medium text-destructive">
                                  Email failed. Share this OTP manually.
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {candidate.inviteEmailFailure}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  OTP is visible to HOD and IT personnel only.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {canViewCandidateOtp ? (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void copyText(candidate.otpCode, "OTP copied")}
                                      >
                                        <Copy className="size-4" />
                                        Copy OTP {candidate.otpCode}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void copyText(buildCandidateLink(candidate), "Candidate assessment link copied")}
                                      >
                                        <Copy className="size-4" />
                                        Copy link
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
                          </td>

                          <td className="px-4 py-3">
                            <p className="max-w-[260px] truncate font-medium">{candidate.jobTitle ?? job.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {candidateAssessments.map((assessment) => assessment.code).join(", ") || pendingAssessmentId}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <Badge
                              variant={emailFailed ? "outline" : "secondary"}
                              className={
                                emailFailed
                                  ? "border-destructive/30 bg-destructive/10 text-destructive capitalize"
                                  : "capitalize"
                              }
                            >
                              {candidate.inviteEmailStatus ?? "sent"}
                            </Badge>
                            <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                              {formatDate(candidate.invitedAt)}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant={candidate.isInviteExpired ? "outline" : "secondary"}>
                              {candidate.isInviteExpired ? "Expired" : "Active"}
                            </Badge>
                            <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                              {formatDate(candidate.inviteExpiresAt)}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            {candidateResults.length ? (
                              <>
                                <Badge variant="secondary">
                                  {/* {candidateResults.length}/{candidateAssessmentIds.length}  */}
                                  submitted
                                </Badge>
                                <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                                  {formatDate(candidateResults[0].submittedAt)}
                                </p>
                                <p className="mt-2 text-xs font-medium text-foreground">
                                  Score: {latestResult ? `${latestResult.score ?? 0}%` : "Not Attempted"}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs font-medium text-foreground">Not Attempted</p>
                                <p className="mt-1 text-xs text-muted-foreground">No submission yet</p>
                              </>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {latestResult ? (
                              <Link
                                href={`/admin/submissions/${latestResult.id}`}
                                className="mr-1 inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground hover:text-black"
                              >
                                <span className="relative block w-fit after:absolute after:left-0 after:bottom-0 after:block after:h-[1px] after:w-full after:origin-center after:scale-x-0 after:bg-current after:transition after:duration-300 after:content-[''] hover:after:scale-x-100">
                                  View
                                </span>
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground"> WAITING </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!isLoading && !paginatedCandidates.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          {jobCandidates.length
                            ? "No candidates match your search or filter."
                            : "Invited candidates for this job will appear here."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

              <div className="mt-auto flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {currentCandidatePage} of {totalCandidatePages} - {filteredJobCandidates.length} candidates
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentCandidatePage <= 1}
                    onClick={() => setCandidatePage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentCandidatePage >= totalCandidatePages}
                    onClick={() => setCandidatePage((page) => Math.min(totalCandidatePages, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            <div className="hidden">
            {jobCandidates.map((candidate) => {
              const result = jobResults.find((item) =>
                item.candidateId
                  ? item.candidateId === candidate.id
                  : item.candidateEmail === candidate.email && item.assessmentId === candidate.jobId,
              );
              const assessment = job.assessments.find((item) => item.id === candidate.jobId);
              const emailFailed = candidate.inviteEmailStatus === "failed";
              return (
                <div key={candidate.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{candidate.name}</p>
                      <p className="text-sm text-muted-foreground">{candidate.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {assessment?.code ?? "Assessment"} · invite {candidate.inviteEmailStatus ?? "sent"} · {formatDate(candidate.invitedAt)}
                      </p>
                      {emailFailed ? (
                        <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 p-3">
                          <p className="text-xs font-medium text-destructive">
                            Email failed. Share this OTP manually.
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {candidate.inviteEmailFailure}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText(candidate.otpCode, "OTP copied")}
                            >
                              <Copy className="size-4" />
                              Copy OTP {candidate.otpCode}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText(buildCandidateLink(candidate), "Candidate assessment link copied")}
                            >
                              <Copy className="size-4" />
                              Copy invite link
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <Button asChild variant={result ? "default" : "outline"} size="sm">
                      <Link href={result ? `/admin/submissions/${result.id}` : `/admin/assessment/${candidate.jobId}`}>
                        {result ? `Open submission (${result.score}%)` : "Send / waiting"}
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
            {!jobCandidates.length ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Invited candidates for this job will appear here.
              </div>
            ) : null}
            </div>
          </CardContent>
        </Card>
        ) : null}
      </section>
    </main>
  );
}
