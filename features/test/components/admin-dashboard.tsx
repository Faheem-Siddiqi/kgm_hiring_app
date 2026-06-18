"use client";

import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Mail,
  Plus,
  Trophy,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  createCandidate,
  createJobAssessment,
  readAdminDataSnapshot,
  subscribeToAdminData,
  type AssessmentResult,
} from "@/features/test/admin-storage";

type AdminSnapshot = {
  candidates?: ReturnType<typeof import("@/features/test/admin-storage").readCandidates>;
  jobs?: ReturnType<typeof import("@/features/test/admin-storage").readJobAssessments>;
  results?: AssessmentResult[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminDashboard() {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("all");
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateJobId, setCandidateJobId] = useState("");
  const snapshot = useSyncExternalStore(
    subscribeToAdminData,
    readAdminDataSnapshot,
    () => "{}",
  );
  const adminData = JSON.parse(snapshot) as AdminSnapshot;
  const jobs = adminData.jobs ?? [];
  const candidates = adminData.candidates ?? [];
  const results = adminData.results ?? [];
  const activeCandidateJobId = candidateJobId || jobs[0]?.id || "";
  const visibleResults =
    selectedAssessmentId === "all"
      ? results
      : results.filter((result) => result.assessmentId === selectedAssessmentId);
  const topCandidates = [...visibleResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const averageScore = visibleResults.length
    ? Math.round(
        visibleResults.reduce((total, result) => total + result.score, 0) /
          visibleResults.length,
      )
    : 0;
  const autoSubmittedCount = visibleResults.filter(
    (result) => result.status === "Auto submitted",
  ).length;

  function handleCreateAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!assessmentTitle.trim() || !jobTitle.trim()) {
      return;
    }

    const job = createJobAssessment(assessmentTitle.trim(), jobTitle.trim());
    setSelectedAssessmentId(job.id);
    setCandidateJobId(job.id);
    setAssessmentTitle("");
    setJobTitle("");
    toast.success("Assessment created for job");
  }

  function handleAddCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!candidateName.trim() || !candidateEmail.trim() || !activeCandidateJobId) {
      return;
    }

    createCandidate(
      candidateName.trim(),
      candidateEmail.trim(),
      activeCandidateJobId,
    );
    toast.success(`Email sent to ${candidateEmail.trim()}`);
    setCandidateName("");
    setCandidateEmail("");
  }

  return (
    <main className="min-h-svh bg-background px-4 py-16 text-foreground sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="gap-2">
              <BarChart3 className="size-3.5" />
              Admin
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              Assessment control
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Create job assessments, invite candidates, and review assessment
              results from one focused workspace.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/test">
              <ArrowLeft className="size-4" />
              Return to assessment
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <BriefcaseBusiness className="mb-3 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Assessments</p>
              <p className="mt-1 text-2xl font-semibold">{jobs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <UserPlus className="mb-3 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Candidates</p>
              <p className="mt-1 text-2xl font-semibold">{candidates.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <CheckCircle2 className="mb-3 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Submissions</p>
              <p className="mt-1 text-2xl font-semibold">
                {visibleResults.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Trophy className="mb-3 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Average score</p>
              <p className="mt-1 text-2xl font-semibold">{averageScore}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create assessment</CardTitle>
                <CardDescription>
                  Build a new assessment entry for a specific job.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleCreateAssessment}>
                  <div className="space-y-2">
                    <Label htmlFor="assessment-title">Assessment name</Label>
                    <Input
                      id="assessment-title"
                      value={assessmentTitle}
                      onChange={(event) => setAssessmentTitle(event.target.value)}
                      placeholder="Admin Officer Screening"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-title">Specific job</Label>
                    <Input
                      id="job-title"
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                      placeholder="Assistant Admin Officer"
                    />
                  </div>
                  <Button className="w-full" type="submit">
                    <Plus className="size-4" />
                    Create assessment
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add candidate</CardTitle>
                <CardDescription>
                  Assign a candidate to a job and simulate the email invite.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleAddCandidate}>
                  <div className="space-y-2">
                    <Label htmlFor="candidate-name">Candidate name</Label>
                    <Input
                      id="candidate-name"
                      value={candidateName}
                      onChange={(event) => setCandidateName(event.target.value)}
                      placeholder="Candidate name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="candidate-email">Email</Label>
                    <Input
                      id="candidate-email"
                      type="email"
                      value={candidateEmail}
                      onChange={(event) => setCandidateEmail(event.target.value)}
                      placeholder="candidate@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assign to job</Label>
                    <div className="grid gap-2">
                      {jobs.map((job) => (
                        <Button
                          key={job.id}
                          type="button"
                          variant={
                            activeCandidateJobId === job.id ? "default" : "outline"
                          }
                          onClick={() => setCandidateJobId(job.id)}
                        >
                          {job.role}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" type="submit">
                    <Mail className="size-4" />
                    Send invite
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle>Results</CardTitle>
                    <CardDescription>
                      View all assessments or filter to one specific assessment.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {autoSubmittedCount} auto submitted
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant={selectedAssessmentId === "all" ? "default" : "outline"}
                    onClick={() => setSelectedAssessmentId("all")}
                  >
                    All assessments
                  </Button>
                  {jobs.map((job) => (
                    <Button
                      key={job.id}
                      size="sm"
                      type="button"
                      variant={
                        selectedAssessmentId === job.id ? "default" : "outline"
                      }
                      onClick={() => setSelectedAssessmentId(job.id)}
                    >
                      {job.role}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleResults.length ? (
                  visibleResults.map((result) => (
                    <div
                      key={result.id}
                      className="rounded-md border bg-card p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{result.candidateName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {result.assessmentTitle} · {result.candidateEmail}
                          </p>
                        </div>
                        <Badge
                          variant={
                            result.status === "Auto submitted"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {result.status}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <Progress value={result.score} />
                        <span className="text-sm font-medium">
                          {result.score}%
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>
                          {result.answeredCount}/{result.totalQuestions} answered
                        </span>
                        <span>{formatDate(result.submittedAt)}</span>
                        <span>{result.violations.length} violations</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                    No submissions yet. Completed tests will appear here.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top candidates</CardTitle>
                <CardDescription>
                  Graphical ranking for the selected assessment scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topCandidates.length ? (
                  topCandidates.map((candidate, index) => (
                    <div key={candidate.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {index + 1}. {candidate.candidateName}
                        </span>
                        <span className="text-muted-foreground">
                          {candidate.score}%
                        </span>
                      </div>
                      <Progress value={candidate.score} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                    Top candidates will be ranked after submissions.
                  </div>
                )}
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  {jobs.map((job) => {
                    const assignedCount = candidates.filter(
                      (candidate) => candidate.jobId === job.id,
                    ).length;

                    return (
                      <div key={job.id} className="rounded-md border p-4">
                        <p className="text-sm font-medium">{job.role}</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {assignedCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          assigned candidates
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
