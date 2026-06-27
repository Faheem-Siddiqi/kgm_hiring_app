"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, Copy, Loader2, Save, Send, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  JOB_EXPERIENCE_LEVELS,
  JOB_LOCATIONS,
  type JobAssessmentOption,
  type PublicJob,
} from "@/lib/job-types";
import {
  createCandidate,
  readAdminDataSnapshot,
  subscribeToAdminData,
  updateCandidateInviteEmailStatus,
  upsertJobAssessment,
  type AssessmentResult,
  type Candidate,
} from "@/features/test/admin-storage";

type AdminSnapshot = {
  candidates?: Candidate[];
  results?: AssessmentResult[];
};

type CandidateInviteResponse = {
  message?: string;
  mail?: { sent?: boolean; reason?: string | null };
};

function useAdminData() {
  const snapshot = useSyncExternalStore(subscribeToAdminData, readAdminDataSnapshot, () => "{}");
  const data = JSON.parse(snapshot) as AdminSnapshot;
  return { candidates: data.candidates ?? [], results: data.results ?? [] };
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
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [inviteAssessmentId, setInviteAssessmentId] = useState(job.assessmentIds[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const { candidates, results } = useAdminData();
  const jobCandidates = useMemo(
    () => candidates.filter((candidate) => job.assessmentIds.includes(candidate.jobId)),
    [candidates, job.assessmentIds],
  );
  const jobResults = useMemo(
    () => results.filter((result) => job.assessmentIds.includes(result.assessmentId)),
    [job.assessmentIds, results],
  );
  const completionRate = jobCandidates.length
    ? Math.round((jobResults.length / jobCandidates.length) * 100)
    : 0;
  const stats: StatItem[] = [
    { label: "Candidates", value: jobCandidates.length, icon: Users },
    { label: "Completed", value: `${completionRate}%`, icon: CheckCircle2 },
    { label: "Assessments", value: job.assessments.length, icon: ClipboardList },
    { label: "Status", value: job.status, icon: ClipboardList },
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
        status: job.status,
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

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assessment = job.assessments.find((item) => item.id === inviteAssessmentId);
    if (!candidateName.trim() || !candidateEmail.trim() || !assessment) {
      toast.error("Candidate name, email, and assessment are required.");
      return;
    }

    upsertJobAssessment(runtimeAssessmentFromJob(job, assessment));
    const candidate = createCandidate(candidateName.trim(), candidateEmail.trim(), assessment.id);
    setSendingInvite(true);
    let response: Response;
    let payload: CandidateInviteResponse;

    try {
      response = await fetch("/api/admin/candidate-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          assessmentTitle: `${job.title} - ${assessment.name}`,
          otpCode: candidate.otpCode,
          inviteUrl: buildCandidateLink(candidate),
        }),
      });
      payload = (await response.json()) as CandidateInviteResponse;
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Could not reach the mail service.";
      setSendingInvite(false);
      updateCandidateInviteEmailStatus(candidate.id, "failed", reason);
      toast.error("Email failed. Manual OTP is now available in the candidates table.");
      return;
    }

    setSendingInvite(false);

    if (!response.ok || !payload.mail?.sent) {
      updateCandidateInviteEmailStatus(
        candidate.id,
        "failed",
        payload.mail?.reason ?? payload.message ?? "Email could not be sent.",
      );
      toast.error("Email failed. Manual OTP is now available in the candidates table.");
      return;
    }

    updateCandidateInviteEmailStatus(candidate.id, "sent");
    setCandidateName("");
    setCandidateEmail("");
    toast.success(`Invite email sent to ${candidate.email}.`);
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
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
                <CardDescription>Choose the assessment connected to this job.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={sendInvite}>
                  <div className="space-y-2">
                    <Label htmlFor="invite-assessment">Assessment</Label>
                    <select id="invite-assessment" className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none" value={inviteAssessmentId} onChange={(event) => setInviteAssessmentId(event.target.value)}>
                      {job.assessments.map((assessment) => (
                        <option key={assessment.id} value={assessment.id}>{assessment.code} · {assessment.name}</option>
                      ))}
                    </select>
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
          <CardContent className="grid gap-3">
            {jobCandidates.map((candidate) => {
              const result = jobResults.find((item) => item.candidateEmail === candidate.email && item.assessmentId === candidate.jobId);
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
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
