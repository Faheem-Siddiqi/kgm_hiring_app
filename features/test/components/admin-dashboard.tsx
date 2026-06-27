"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Bell,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  Users,
  X,
} from "lucide-react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
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
import {
  readAdminDataSnapshot,
  subscribeToAdminData,
  updateJobAssessmentConfig,
  type AssessmentResult,
  type Candidate,
  type JobAssessment,
} from "@/features/test/admin-storage";
import type {
  AssessmentListSummary,
  PublicAssessment,
} from "@/lib/assessment-types";
import type { PublicJob } from "@/lib/job-types";

type AdminSnapshot = {
  candidates?: Candidate[];
  jobs?: JobAssessment[];
  results?: AssessmentResult[];
};

type AdminNotification = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: "default" | "warning" | "success";
  href?: string;
};

type AdminDashboardProps = {
  initialServerAssessments?: PublicAssessment[];
  initialServerAssessmentSummary?: AssessmentListSummary;
  initialPublicJobs?: PublicJob[];
};

const READ_NOTIFICATIONS_KEY = "kgm-hiring-admin-read-notifications";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function useAdminData() {
  const snapshot = useSyncExternalStore(
    subscribeToAdminData,
    readAdminDataSnapshot,
    () => "{}",
  );
  const adminData = JSON.parse(snapshot) as AdminSnapshot;

  return {
    candidates: adminData.candidates ?? [],
    jobs: adminData.jobs ?? [],
    results: adminData.results ?? [],
  };
}

function getAverageScore(results: AssessmentResult[]) {
  if (!results.length) {
    return 0;
  }

  return Math.round(
    results.reduce((total, result) => total + result.score, 0) /
      results.length,
  );
}

function getAssessmentStats(
  job: JobAssessment,
  candidates: Candidate[],
  results: AssessmentResult[],
) {
  const assignedCandidates = candidates.filter(
    (candidate) => candidate.jobId === job.id,
  );
  const assessmentResults = results.filter(
    (result) => result.assessmentId === job.id,
  );

  return {
    assignedCandidates,
    assessmentResults,
    averageScore: getAverageScore(assessmentResults),
    completionRate: assignedCandidates.length
      ? Math.round((assessmentResults.length / assignedCandidates.length) * 100)
      : 0,
  };
}

function buildAdminNotifications(
  jobs: JobAssessment[],
  candidates: Candidate[],
  results: AssessmentResult[],
) {
  const resultNotifications: AdminNotification[] = results.slice(0, 3).map(
    (result) => ({
      id: `result-${result.id}`,
      title: `${result.candidateName} submitted`,
      description: `${result.assessmentTitle} scored ${result.score}%`,
      time: formatDate(result.submittedAt),
      tone: result.status === "Auto submitted" ? "warning" : "success",
      href: `/admin/submissions/${result.id}`,
    }),
  );
  const pendingInvites = candidates.filter(
    (candidate) =>
      !results.some((result) => result.candidateEmail === candidate.email),
  );
  const inviteNotifications: AdminNotification[] = pendingInvites
    .slice(0, 2)
    .map((candidate) => ({
      id: `invite-${candidate.id}`,
      title: "Invite awaiting submission",
      description: `${candidate.name} has OTP ${candidate.otpCode}`,
      time: formatDate(candidate.invitedAt),
      tone: "default",
      href: `/admin/assessment/${candidate.jobId}`,
    }));
  const assessmentNotifications: AdminNotification[] = jobs.slice(0, 2).map(
    (job) => ({
      id: `assessment-${job.id}`,
      title: "Assessment available",
      description: `${job.role} is ready for candidate invites`,
      time: formatDate(job.createdAt),
      tone: "default",
      href: `/admin/assessment/${job.id}`,
    }),
  );

  return [
    ...resultNotifications,
    ...inviteNotifications,
    ...assessmentNotifications,
  ];
}

function readNotificationIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(
      window.localStorage.getItem(READ_NOTIFICATIONS_KEY) ?? "[]",
    ) as string[];
  } catch {
    return [];
  }
}

function writeNotificationIds(ids: string[]) {
  window.localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(ids));
}

function toDashboardAssessment(assessment: PublicAssessment): JobAssessment {
  return {
    id: assessment.id,
    title: assessment.name,
    role: assessment.questionBankName,
    createdAt: assessment.createdAt,
    resourceId: assessment.questionBankId,
    sectionCount: assessment.sectionCount,
    timePerSectionMinutes: Math.max(
      1,
      Math.round(
        assessment.sectionSettings.reduce(
          (total, section) =>
            total +
            Math.max(
              section.types.mcq.timeLimitSeconds,
              section.types.multi.timeLimitSeconds,
              section.types.text.timeLimitSeconds,
            ),
          0,
        ) / 60,
      ),
    ),
    questionsPerTest: assessment.totalQuestions,
    questionsPerSection: Math.max(
      1,
      Math.round(assessment.totalQuestions / Math.max(assessment.sectionCount, 1)),
    ),
    dummyQuestionsPerSection: 0,
  };
}

export function AdminDashboard({
  initialServerAssessments = [],
  initialServerAssessmentSummary,
  initialPublicJobs = [],
}: AdminDashboardProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>(() =>
    readNotificationIds(),
  );
  const { candidates, jobs, results } = useAdminData();
  const dashboardJobs = useMemo(
    () =>
      jobs.length
        ? jobs
        : initialServerAssessments.map(toDashboardAssessment),
    [initialServerAssessments, jobs],
  );
  const latestResults = useMemo(() => results.slice(0, 4), [results]);
  const notifications = useMemo(
    () => buildAdminNotifications(dashboardJobs, candidates, results).slice(0, 6),
    [dashboardJobs, candidates, results],
  );
  const unreadNotifications = notifications.filter(
    (notification) => !readNotifications.includes(notification.id),
  );
  const averageScore = getAverageScore(results);
  const completedCount = results.filter(
    (result) => result.status === "Submitted",
  ).length;
  const assessmentCount =
    jobs.length || initialServerAssessmentSummary?.total || dashboardJobs.length;
  const publicJobCount = initialPublicJobs.length;

  function markNotificationRead(id: string) {
    setReadNotifications((current) => {
      const next = current.includes(id) ? current : [...current, id];
      writeNotificationIds(next);
      return next;
    });
  }

  function markAllNotificationsRead() {
    const next = notifications.map((notification) => notification.id);
    setReadNotifications(next);
    writeNotificationIds(next);
    toast.success("Notifications marked as read");
  }

  function handleConfigChange(
    job: JobAssessment,
    field:
      | "sectionCount"
      | "timePerSectionMinutes"
      | "questionsPerTest"
      | "questionsPerSection",
    value: string,
  ) {
    updateJobAssessmentConfig(job.id, {
      sectionCount: job.sectionCount,
      timePerSectionMinutes: job.timePerSectionMinutes,
      questionsPerTest: job.questionsPerTest,
      questionsPerSection: job.questionsPerSection,
      dummyQuestionsPerSection: job.dummyQuestionsPerSection,
      [field]: Number(value),
    });
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar
        notificationCount={unreadNotifications.length}
        notificationsOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((value) => !value)}
        notificationPanel={
          <div className="absolute right-0 top-11 z-30 w-[360px] rounded-lg border bg-card p-3 text-card-foreground shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {unreadNotifications.length} unread admin updates
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllNotificationsRead}
                disabled={!unreadNotifications.length}
              >
                Mark all read
              </Button>
              <Button
                aria-label="Close notifications"
                size="icon"
                variant="ghost"
                onClick={() => setNotificationsOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-md border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      {notification.title}
                    </p>
                    <Badge
                      variant={
                        notification.tone === "warning"
                          ? "secondary"
                          : notification.tone === "success"
                            ? "default"
                            : "outline"
                      }
                    >
                      {notification.tone === "warning"
                        ? "Review"
                        : notification.tone === "success"
                          ? "New"
                          : "Info"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {notification.time}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {notification.href ? (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={notification.href}
                          onClick={() => markNotificationRead(notification.id)}
                        >
                          Open
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markNotificationRead(notification.id)}
                      disabled={readNotifications.includes(notification.id)}
                    >
                      {readNotifications.includes(notification.id)
                        ? "Read"
                        : "Mark read"}
                    </Button>
                  </div>
                </div>
              ))}
              {!notifications.length ? (
                <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                  No notifications yet.
                </div>
              ) : null}
            </div>
          </div>
        }
      />

      <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div id="overview" className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit gap-2">
              <BarChart3 className="size-3.5" />
              Hiring operations
            </Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Recruitment assessment workspace
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Track assessment activity, review submissions, and open focused
                analytics for each configured assessment.
              </p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Pipeline health</CardTitle>
              <CardDescription>Current assessment activity at a glance.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Assessments",
                  value: assessmentCount,
                  icon: BriefcaseBusiness,
                },
                {
                  label: "Open jobs",
                  value: publicJobCount,
                  icon: Users,
                },
                {
                  label: "Submissions",
                  value: results.length,
                  icon: CheckCircle2,
                },
                {
                  label: "Avg. score",
                  value: `${averageScore}%`,
                  icon: BarChart3,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-md border p-4">
                  <Icon className="mb-3 size-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card id="notifications">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Admin notifications</CardTitle>
                    <CardDescription>
                      Priority updates from invites, submissions, and assessments.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Bell className="size-3" />
                    {unreadNotifications.length} unread
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-md border bg-muted/20 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{notification.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {notification.description}
                        </p>
                      </div>
                      <Badge
                        variant={
                          notification.tone === "warning"
                            ? "secondary"
                            : notification.tone === "success"
                              ? "default"
                              : "outline"
                        }
                      >
                        {notification.tone === "warning"
                          ? "Needs review"
                          : notification.tone === "success"
                            ? "Fresh"
                            : "General"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{notification.time}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markNotificationRead(notification.id)}
                        disabled={readNotifications.includes(notification.id)}
                      >
                        {readNotifications.includes(notification.id)
                          ? "Read"
                          : "Mark as read"}
                      </Button>
                    </div>
                  </div>
                ))}
                {!notifications.length ? (
                  <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div id="assessments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessments</CardTitle>
                <CardDescription>
                  Open one assessment to view its own KPIs, graphs, candidates,
                  and CV preview.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboardJobs.map((job) => {
                  const stats = getAssessmentStats(job, candidates, results);

                  return (
                    <Link
                      key={job.id}
                      href={`/admin/assessment/${job.id}`}
                      className="group block rounded-lg border p-4 transition hover:border-foreground/30 hover:bg-muted/35"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium">{job.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {job.role} - created {formatDate(job.createdAt)}
                          </p>
                        </div>
                        <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition group-hover:bg-accent sm:w-auto">
                          Open analytics
                          <ArrowRight className="size-4" />
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Invited</p>
                          <p className="text-lg font-semibold">
                            {stats.assignedCandidates.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Complete</p>
                          <p className="text-lg font-semibold">
                            {stats.completionRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg. score</p>
                          <p className="text-lg font-semibold">
                            {stats.averageScore}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-4">
                        <span>{job.sectionCount} sections</span>
                        <span>{job.timePerSectionMinutes} min each</span>
                        <span>{job.questionsPerSection} questions each</span>
                        <span>{job.questionsPerTest} total questions</span>
                      </div>
                      <Progress className="mt-4" value={stats.completionRate} />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assessment setup</CardTitle>
                <CardDescription>
                  Edit section count, timing, and question pick size.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardJobs.map((job) => (
                  <div key={job.id} className="rounded-md border p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="text-sm text-muted-foreground">{job.role}</p>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="size-3" />
                        editable
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["sectionCount", "Sections"],
                        ["timePerSectionMinutes", "Minutes / section"],
                        ["questionsPerSection", "Questions / section"],
                      ].map(([field, label]) => (
                        <div key={field} className="space-y-2">
                          <Label htmlFor={`${job.id}-${field}`}>{label}</Label>
                          <Input
                            id={`${job.id}-${field}`}
                            type="number"
                            min={1}
                            value={String(
                              job[field as keyof Pick<
                                JobAssessment,
                                | "sectionCount"
                                | "timePerSectionMinutes"
                                | "questionsPerSection"
                              >],
                            )}
                            onChange={(event) =>
                              handleConfigChange(
                                job,
                                field as
                                  | "sectionCount"
                                  | "timePerSectionMinutes"
                                  | "questionsPerSection",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent submissions</CardTitle>
                <CardDescription>
                  Latest candidate activity across all assessments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestResults.length ? (
                  latestResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{result.candidateName}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.assessmentTitle}
                        </p>
                      </div>
                      <Badge variant={result.status === "Submitted" ? "default" : "secondary"}>
                        {result.score}%
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                    No submissions yet. Completed tests will appear here.
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-4">
                    <Mail className="mb-3 size-4 text-muted-foreground" />
                    <p className="text-2xl font-semibold">{candidates.length}</p>
                    <p className="text-xs text-muted-foreground">email invites</p>
                  </div>
                  <div className="rounded-md border p-4">
                    <FileText className="mb-3 size-4 text-muted-foreground" />
                    <p className="text-2xl font-semibold">{completedCount}</p>
                    <p className="text-xs text-muted-foreground">review-ready CVs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
