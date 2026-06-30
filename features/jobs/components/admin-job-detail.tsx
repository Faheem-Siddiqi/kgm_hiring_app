"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Copy, Eye, Loader2, Save, Search, Send, Users, type LucideIcon } from "lucide-react";
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
  const localSnapshot = useSyncExternalStore(
    subscribeToAdminData,
    readAdminDataSnapshot,
    () => "{}",
  );
  const loadData = useCallback(async () => {
    const snapshot = await fetchAdminDataSnapshot();
    setData({ candidates: snapshot.candidates, results: snapshot.results });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const snapshot = await fetchAdminDataSnapshot();
        if (active) {
          setData({ candidates: snapshot.candidates, results: snapshot.results });
        }
      } catch (error) {
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

  return { candidates, results, canViewCandidateOtp, refresh: loadData };
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
    dummyQuestionsPerSection: 0,
  };
}

type StatItem = {
  label: string;
  value: string | number;
  icon: LucideIcon;
};

export function AdminJobDetail({
  job,
  assessments,
}: {
  job: PublicJob;
  assessments: JobAssessmentOption[];
}) {
  const [title, setTitle] = useState(job.title);
  const [department, setDepartment] = useState(job.department);
  const [location, setLocation] = useState(job.location);
  const [experience, setExperience] = useState(job.experience);
  const [description, setDescription] = useState(job.description);
  const [responsibilities, setResponsibilities] = useState(job.responsibilities.join("\n"));
  const [requirements, setRequirements] = useState(job.requirements.join("\n"));
  const [assessmentIds, setAssessmentIds] = useState(job.assessmentIds);
  const [currentStatus, setCurrentStatus] = useState(job.status);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [inviteExpiryDate, setInviteExpiryDate] = useState(defaultInviteExpiryInputValue);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [existingInvite, setExistingInvite] = useState<{
    candidate: Candidate;
    assessmentTitle: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [resendingExistingInvite, setResendingExistingInvite] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [reopeningJob, setReopeningJob] = useState(false);
  const { candidates, results, canViewCandidateOtp, refresh } = useAdminData();
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
  const filteredJobCandidates = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase();

    if (!query) return jobCandidates;

    return jobCandidates.filter((candidate) => {
      const candidateAssessmentIds = candidate.assessmentIds?.length
        ? candidate.assessmentIds
        : [candidate.jobId];
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
  }, [candidateSearch, job.assessments, jobCandidates]);
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
    return `${origin}/?otp=${candidate.otpCode}`;
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
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href="/admin/jobs" aria-label="Back to jobs">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{job.department}</p>
              <h1 className="truncate text-xl font-semibold tracking-tight">{job.title}</h1>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={`/jobs/${job.slug}`}>Public job</Link>
          </Button>
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
          <Card>
            <CardHeader>
              <CardTitle>Edit job</CardTitle>
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
                          type="checkbox"
                          className="mt-1 size-4 accent-primary"
                          checked={assessmentIds.includes(assessment.id)}
                          onChange={() =>
                            setAssessmentIds((current) =>
                              current.includes(assessment.id)
                                ? current.filter((id) => id !== assessment.id)
                                : [...current, assessment.id],
                            )
                          }
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

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invite candidate</CardTitle>
                <CardDescription>One invitation opens every assessment assigned to this job.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={sendInvite}>
                  <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                    The candidate will see {job.assessments.length} assessment{job.assessments.length === 1 ? "" : "s"} after login and can complete them one by one.
                  </div>
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
                  <div className="space-y-2">
                    <Label htmlFor="invite-expiry">Invitation expiry</Label>
                    <Input
                      id="invite-expiry"
                      type="date"
                      value={inviteExpiryDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => setInviteExpiryDate(event.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={!job.assessments.length || sendingInvite}>
                    {sendingInvite ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {sendingInvite ? "Sending invite" : "Send invite"}
                  </Button>
                </form>
              </CardContent>
            </Card>

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
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Candidates for this job</CardTitle>
            <CardDescription>Open candidate assessment detail when a submission exists.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
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

            <div className="overflow-hidden rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Candidate</th>
                      <th className="px-4 py-3 font-medium">Assessment</th>
                      <th className="px-4 py-3 font-medium">Invite</th>
                      <th className="px-4 py-3 font-medium">Expiry</th>
                      <th className="px-4 py-3 font-medium">Submission</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedCandidates.map((candidate) => {
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
                            <p className="text-xs text-muted-foreground">{candidate.email}</p>
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
                            <p className="font-medium">{candidate.jobTitle ?? job.title}</p>
                            <p className="text-xs text-muted-foreground">
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
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(candidate.invitedAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={candidate.isInviteExpired ? "outline" : "secondary"}>
                              {candidate.isInviteExpired ? "Expired" : "Active"}
                            </Badge>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(candidate.inviteExpiresAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {candidateResults.length ? (
                              <>
                                <Badge variant="secondary">
                                  {candidateResults.length}/{candidateAssessmentIds.length} submitted
                                </Badge>
                                <p className="mt-1 text-xs text-muted-foreground">{formatDate(candidateResults[0].submittedAt)}</p>
                              </>
                            ) : (
                              <Badge variant="outline">Waiting</Badge>
                            )}
                          </td>
                        
                        
                      <td className="px-4 py-3">
  <div className="flex h-full items-center">
    <span className="text-xs font-medium text-foreground">
      {latestResult ? `${latestResult.score ?? 0}%` : "Not Attempted"}
    </span>
  </div>
</td>
                          <td className="px-4 py-3 text-right">


                            <Link
  href={latestResult ? `/admin/submissions/${latestResult.id}` : "#"}
  onClick={(e) => {
    if (!latestResult) e.preventDefault();
  }}
  aria-disabled={!latestResult}
  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide hover:text-black text-muted-foreground "
>
  <span className="relative block w-fit   after:absolute after:left-0 after:bottom-0 after:block after:h-[1px] after:w-full after:origin-center after:scale-x-0 after:bg-current after:transition after:duration-300 after:content-[''] hover:after:scale-x-100">
    {latestResult ? `View` : "Waiting"}
  </span>
</Link>


                       
                          </td>
                        </tr>
                      );
                    })}
                    {!paginatedCandidates.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          {jobCandidates.length
                            ? "No candidates match your search."
                            : "Invited candidates for this job will appear here."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredJobCandidates.length > CANDIDATES_PER_PAGE ? (
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
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
            ) : null}
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
      </section>
    </main>
  );
}
