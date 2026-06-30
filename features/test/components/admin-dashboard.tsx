"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
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
import { Progress } from "@/components/ui/progress";
import {
  fetchAdminDataSnapshot,
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
  initialHiringStats?: {
    submissions: number;
    averageScore: number;
    assessments: Record<string, { invited: number; submissions: number; averageScore: number }>;
    submissionStats: Record<string, { submissions: number; averageScore: number }>;
    recentInvites?: Array<{
      id: string;
      name: string;
      email: string;
      jobTitle: string;
      invitedAt: string;
      inviteExpiresAt: string;
      isInviteExpired: boolean;
      submittedAt?: string;
    }>;
  };
};

const READ_NOTIFICATIONS_KEY = "kgm-hiring-admin-read-notifications";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function useAdminData(enabled = true) {
  const [adminData, setAdminData] = useState<AdminSnapshot>({});

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function loadData() {
      try {
        const data = await fetchAdminDataSnapshot();
        if (active) {
          setAdminData({ candidates: data.candidates, results: data.results });
        }
      } catch {
        if (active) setAdminData({});
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [enabled]);

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
  initialHiringStats,
}: AdminDashboardProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>(() =>
    readNotificationIds(),
  );
  const { candidates, jobs, results } = useAdminData(!initialHiringStats);
  const dashboardJobs = useMemo(
    () =>
      jobs.length
        ? jobs
        : initialServerAssessments.map(toDashboardAssessment),
    [initialServerAssessments, jobs],
  );
  const notifications = useMemo(
    () => buildAdminNotifications(dashboardJobs, candidates, results).slice(0, 6),
    [dashboardJobs, candidates, results],
  );
  const unreadNotifications = notifications.filter(
    (notification) => !readNotifications.includes(notification.id),
  );
  const averageScore = results.length
    ? getAverageScore(results)
    : initialHiringStats?.averageScore ?? 0;
  const dashboardInvites =
    candidates.length
      ? candidates.slice(0, 8).map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          jobTitle: candidate.jobTitle ?? candidate.jobId,
          invitedAt: candidate.invitedAt,
          inviteExpiresAt: candidate.inviteExpiresAt,
          isInviteExpired: candidate.isInviteExpired,
          submittedAt: candidate.submittedAt,
        }))
      : initialHiringStats?.recentInvites ?? [];
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

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar
        notificationCount={unreadNotifications.length}
        notificationsOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((value) => !value)}
        notificationPanel={
          <div className="absolute right-0 top-11 z-30 max-h-[min(75vh,640px)] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg sm:w-96">
            <div className="flex items-start justify-between gap-3 border-b p-3">
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {unreadNotifications.length} unread admin updates
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
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
            </div>
            <div className="max-h-[calc(min(75vh,640px)-116px)] space-y-2 overflow-y-auto p-3">
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
            <div className="border-t p-3">
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/notifications" onClick={() => setNotificationsOpen(false)}>
                  View all notifications
                </Link>
              </Button>
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
                  value: results.length || initialHiringStats?.submissions || 0,
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

        <div id="assessments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Candidate invites</CardTitle>
                <CardDescription>
                  Recent assessment invitations with candidate, job, and expiry status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-md border">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Candidate</th>
                          <th className="px-4 py-3 font-medium">Job</th>
                          <th className="px-4 py-3 font-medium">Invited</th>
                          <th className="px-4 py-3 font-medium">Expires</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {dashboardInvites.map((invite) => (
                          <tr key={invite.id} className="bg-background">
                            <td className="px-4 py-3">
                              <p className="font-medium">{invite.name}</p>
                              <p className="text-xs text-muted-foreground">{invite.email}</p>
                            </td>
                            <td className="px-4 py-3">{invite.jobTitle}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(invite.invitedAt)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(invite.inviteExpiresAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  invite.submittedAt
                                    ? "default"
                                    : invite.isInviteExpired
                                      ? "outline"
                                      : "secondary"
                                }
                              >
                                {invite.submittedAt
                                  ? "Submitted"
                                  : invite.isInviteExpired
                                    ? "Expired"
                                    : "Active"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {!dashboardInvites.length ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                              Candidate assessment invites will appear here.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  const aggregateStats = initialHiringStats?.assessments[job.id];
                  const aggregateSubmissions = initialHiringStats?.submissionStats[job.id];
                  const stats = candidates.length || results.length
                    ? getAssessmentStats(job, candidates, results)
                    : {
                        assignedCandidates: Array.from({ length: aggregateStats?.invited ?? 0 }),
                        assessmentResults: Array.from({ length: aggregateSubmissions?.submissions ?? 0 }),
                        averageScore: aggregateSubmissions?.averageScore ?? 0,
                        completionRate: aggregateStats?.invited
                          ? Math.round(((aggregateSubmissions?.submissions ?? 0) / aggregateStats.invited) * 100)
                          : 0,
                      };

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
        </div>
      </section>
    </main>
  );
}
