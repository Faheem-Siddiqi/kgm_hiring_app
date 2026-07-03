"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Clock3,
  FileCheck2,
  Mail,
  Search,
  ShieldAlert,
  Target,
  TimerReset,
  X,
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
import { cn } from "@/lib/utils";

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

type DashboardInvite = {
  id: string;
  name: string;
  email: string;
  jobAssignmentId?: string;
  jobTitle: string;
  invitedAt: string;
  inviteExpiresAt: string;
  isInviteExpired: boolean;
  submittedAt?: string;
};

type AssessmentDashboardStats = {
  invited: number;
  submissions: number;
  averageScore: number;
  completionRate: number;
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
    recentInvites?: DashboardInvite[];
  };
};

const READ_NOTIFICATIONS_KEY = "kgm-hiring-admin-read-notifications";
const TABLE_PAGE_SIZE = 6;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getDaysUntil(value: string) {
  const difference = new Date(value).getTime() - Date.now();
  return Math.ceil(difference / (24 * 60 * 60 * 1000));
}

function useAdminData(enabled = true) {
  const [adminData, setAdminData] = useState<AdminSnapshot>({});
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function loadData() {
      try {
        const data = await fetchAdminDataSnapshot();
        if (active) {
          setAdminData({ candidates: data.candidates, results: data.results });
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setAdminData({});
          setIsLoading(false);
        }
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
    isLoading,
  };
}

function getAverageScore(results: AssessmentResult[]) {
  if (!results.length) return 0;

  return Math.round(
    results.reduce((total, result) => total + result.score, 0) /
      results.length,
  );
}

function getAssessmentStats(
  job: JobAssessment,
  candidates: Candidate[],
  results: AssessmentResult[],
  initialHiringStats?: AdminDashboardProps["initialHiringStats"],
): AssessmentDashboardStats {
  if (candidates.length || results.length) {
    const assignedCandidates = candidates.filter(
      (candidate) => candidate.jobId === job.id,
    );
    const assessmentResults = results.filter(
      (result) => result.assessmentId === job.id,
    );

    return {
      invited: assignedCandidates.length,
      submissions: assessmentResults.length,
      averageScore: getAverageScore(assessmentResults),
      completionRate: assignedCandidates.length
        ? Math.round((assessmentResults.length / assignedCandidates.length) * 100)
        : 0,
    };
  }

  const inviteStats = initialHiringStats?.assessments[job.id];
  const submissionStats = initialHiringStats?.submissionStats[job.id];
  const invited = inviteStats?.invited ?? 0;
  const submissions = submissionStats?.submissions ?? 0;

  return {
    invited,
    submissions,
    averageScore: submissionStats?.averageScore ?? 0,
    completionRate: invited ? Math.round((submissions / invited) * 100) : 0,
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
      description: `${candidate.name} has an active candidate invite`,
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
  if (typeof window === "undefined") return [];

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

function PaginatedControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Page {Math.min(page, totalPages)} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
          <span className="rounded-md border bg-muted/35 p-2 text-muted-foreground">
            <Icon className="size-4" />
          </span>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function HorizontalBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 text-muted-foreground">{detail}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${clampPercent(value)}%` }}
        />
      </div>
    </div>
  );
}

function ScoreDistribution({ results }: { results: AssessmentResult[] }) {
  const [activeBucket, setActiveBucket] = useState("80-100");
  const buckets = [
    { label: "0-39", min: 0, max: 39, tone: "Needs review" },
    { label: "40-59", min: 40, max: 59, tone: "Developing" },
    { label: "60-79", min: 60, max: 79, tone: "Qualified" },
    { label: "80-100", min: 80, max: 100, tone: "Strong" },
  ].map((bucket) => ({
    ...bucket,
    count: results.filter(
      (result) => result.score >= bucket.min && result.score <= bucket.max,
    ).length,
  }));
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const selectedBucket = buckets.find((bucket) => bucket.label === activeBucket) ?? buckets[3];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-md border bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{selectedBucket.label}% band</p>
          <p className="text-xs text-muted-foreground">{selectedBucket.tone}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-semibold">{selectedBucket.count}</p>
          <p className="text-xs text-muted-foreground">submissions</p>
        </div>
      </div>
      <div className="grid h-64 grid-cols-4 items-end gap-3 rounded-md border bg-muted/20 p-4">
        {buckets.map((bucket) => {
          const active = selectedBucket.label === bucket.label;

          return (
            <button
              key={bucket.label}
              type="button"
              onMouseEnter={() => setActiveBucket(bucket.label)}
              onFocus={() => setActiveBucket(bucket.label)}
              onClick={() => setActiveBucket(bucket.label)}
              className="group flex h-full flex-col justify-end gap-2 rounded-md outline-none"
              aria-label={`${bucket.count} submissions scored ${bucket.label} percent`}
            >
              <div className="flex min-h-0 flex-1 items-end">
                <div
                  className={cn(
                    "relative w-full rounded-t-md transition-all duration-300",
                    active
                      ? "bg-foreground shadow-lg shadow-foreground/15"
                      : "bg-foreground/45 group-hover:bg-foreground/75",
                  )}
                  style={{
                    height: `${bucket.count ? Math.max(12, (bucket.count / maxCount) * 100) : 4}%`,
                  }}
                >
                  <span className="absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-xs shadow-sm group-hover:block group-focus:block">
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
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        {buckets.map((bucket) => (
          <button
            key={bucket.label}
            type="button"
            onClick={() => setActiveBucket(bucket.label)}
            className={cn(
              "rounded-md border px-3 py-2 text-left transition hover:bg-muted/40",
              selectedBucket.label === bucket.label && "border-foreground bg-foreground text-background hover:bg-foreground",
            )}
          >
            <span className="block font-medium">{bucket.label}%</span>
            <span>{bucket.tone}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

function ScoreDistributionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-md border bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <DashboardSkeletonBlock className="h-4 w-24" />
          <DashboardSkeletonBlock className="h-3 w-20" />
        </div>
        <div className="space-y-2 sm:flex sm:flex-col sm:items-end">
          <DashboardSkeletonBlock className="h-7 w-12" />
          <DashboardSkeletonBlock className="h-3 w-20" />
        </div>
      </div>
      <div className="grid h-64 grid-cols-4 items-end gap-3 rounded-md border bg-muted/20 p-4">
        {[38, 56, 76, 92].map((height, index) => (
          <div key={index} className="flex h-full flex-col justify-end gap-2">
            <div className="flex min-h-0 flex-1 items-end">
              <div
                className="w-full animate-pulse rounded-t-md bg-muted"
                style={{ height: `${height}%` }}
              />
            </div>
            <DashboardSkeletonBlock className="mx-auto h-4 w-8" />
            <DashboardSkeletonBlock className="mx-auto h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardSkeletonBlock key={index} className="h-12" />
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <DashboardSkeletonBlock className="h-6 w-52" />
            <DashboardSkeletonBlock className="h-10 w-full max-w-2xl" />
            <DashboardSkeletonBlock className="h-5 w-full max-w-3xl" />
            <div className="flex gap-2">
              <DashboardSkeletonBlock className="h-10 w-32" />
              <DashboardSkeletonBlock className="h-10 w-40" />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <DashboardSkeletonBlock className="h-6 w-36" />
            <DashboardSkeletonBlock className="mt-3 h-10 w-24" />
            <DashboardSkeletonBlock className="mt-5 h-3 w-full rounded-full" />
            <div className="mt-5 grid grid-cols-3 gap-3">
              <DashboardSkeletonBlock className="h-16 w-full" />
              <DashboardSkeletonBlock className="h-16 w-full" />
              <DashboardSkeletonBlock className="h-16 w-full" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-card p-5">
              <DashboardSkeletonBlock className="h-4 w-28" />
              <DashboardSkeletonBlock className="mt-4 h-8 w-20" />
              <DashboardSkeletonBlock className="mt-5 h-4 w-full" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <DashboardSkeletonBlock className="h-80 w-full rounded-lg" />
          <DashboardSkeletonBlock className="h-80 w-full rounded-lg" />
        </div>
        <DashboardSkeletonBlock className="h-96 w-full rounded-lg" />
      </section>
    </main>
  );
}

export function AdminDashboard({
  initialServerAssessments = [],
  initialServerAssessmentSummary,
  initialPublicJobs = [],
  initialHiringStats,
}: AdminDashboardProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [invitePage, setInvitePage] = useState(1);
  const [assessmentPage, setAssessmentPage] = useState(1);
  const [inviteSearch, setInviteSearch] = useState("");
  const [readNotifications, setReadNotifications] = useState<string[]>(() =>
    readNotificationIds(),
  );
  const { candidates, jobs, results, isLoading } = useAdminData(true);
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
  const dashboardInvites: DashboardInvite[] =
    candidates.length
      ? candidates.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          jobAssignmentId: candidate.jobAssignmentId,
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
  const totalInvites = dashboardInvites.length
    ? dashboardInvites.length
    : Object.values(initialHiringStats?.assessments ?? {}).reduce(
        (total, item) => total + item.invited,
        0,
      );
  const submittedInvites = dashboardInvites.filter((invite) => invite.submittedAt).length ||
    initialHiringStats?.submissions ||
    0;
  const activeInvites = dashboardInvites.filter(
    (invite) => !invite.submittedAt && !invite.isInviteExpired,
  ).length;
  const expiredInvites = dashboardInvites.filter(
    (invite) => !invite.submittedAt && invite.isInviteExpired,
  ).length;
  const completionRate = totalInvites
    ? Math.round((submittedInvites / totalInvites) * 100)
    : 0;
  const pendingReview = results.filter(
    (result) => !result.decision && !result.evaluatedAt,
  ).length;
  const autoSubmitted = results.filter(
    (result) => result.status === "Auto submitted",
  ).length;
  const totalViolations = results.reduce(
    (total, result) => total + result.violations.length,
    0,
  );
  const jobsWithAssessments = initialPublicJobs.filter(
    (job) => job.assessmentIds.length,
  ).length;
  const jobCoverage = publicJobCount
      ? Math.round((jobsWithAssessments / publicJobCount) * 100)
      : 0;
  const publicJobsById = new Map(
    initialPublicJobs.map((job) => [job.id, job]),
  );
  const filteredDashboardInvites = dashboardInvites.filter((invite) => {
    const query = inviteSearch.trim().toLowerCase();

    if (!query) return true;

    return [
      invite.name,
      invite.email,
      invite.jobTitle,
      invite.submittedAt
        ? "submitted"
        : invite.isInviteExpired
          ? "expired"
          : "active",
    ].some((value) => value.toLowerCase().includes(query));
  });
  const assessmentRows = dashboardJobs.map((job) => ({
    job,
    stats: getAssessmentStats(job, candidates, results, initialHiringStats),
  }));
  const topAssessments = [...assessmentRows]
    .sort((first, second) => second.stats.invited - first.stats.invited)
    .slice(0, 5);
  const highestAverage = [...assessmentRows]
    .filter((row) => row.stats.submissions)
    .sort((first, second) => second.stats.averageScore - first.stats.averageScore)
    .slice(0, 5);
  const inviteTotalPages = Math.max(1, Math.ceil(filteredDashboardInvites.length / TABLE_PAGE_SIZE));
  const assessmentTotalPages = Math.max(1, Math.ceil(assessmentRows.length / TABLE_PAGE_SIZE));
  const currentInvitePage = Math.min(invitePage, inviteTotalPages);
  const currentAssessmentPage = Math.min(assessmentPage, assessmentTotalPages);
  const pagedInvites = filteredDashboardInvites.slice(
    (currentInvitePage - 1) * TABLE_PAGE_SIZE,
    currentInvitePage * TABLE_PAGE_SIZE,
  );
  const pagedAssessments = assessmentRows.slice(
    (currentAssessmentPage - 1) * TABLE_PAGE_SIZE,
    currentAssessmentPage * TABLE_PAGE_SIZE,
  );

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
            <div className="border-t p-5">
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
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit gap-2">
              <BarChart3 className="size-3.5" />
              Kohinoor Textile Mills Gijar Khan
            </Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Candidate invitation and assessment dashboard
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Monitor the full flow from job setup to candidate invitations,
                assessment completion, scoring, and review decisions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/jobs">
                  Manage jobs
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/submissions">Review submissions</Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline health</CardTitle>
              <CardDescription>
                How effectively invitations are turning into submitted assessments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Completion rate</p>
                  <p className="text-4xl font-semibold tracking-tight">
                    {formatPercent(completionRate)}
                  </p>
                </div>
                <Badge variant={completionRate >= 70 ? "default" : "secondary"}>
                  {submittedInvites} submitted
                </Badge>
              </div>
              <Progress value={completionRate} />
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="font-medium">{activeInvites}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-medium">{expiredInvites}</p>
                  <p className="text-xs text-muted-foreground">Expired</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-medium">{pendingReview}</p>
                  <p className="text-xs text-muted-foreground">Review due</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Jobs published"
            value={publicJobCount}
            detail={`${jobsWithAssessments} jobs have assessments attached`}
            icon={BriefcaseBusiness}
          />
          <StatCard
            label="Assessments ready"
            value={assessmentCount}
            detail={`${jobCoverage}% job coverage across active and inactive jobs`}
            icon={FileCheck2}
          />
          <StatCard
            label="Candidate invites"
            value={totalInvites}
            detail={`${activeInvites} active, ${expiredInvites} expired, ${submittedInvites} completed`}
            icon={Mail}
          />
          <StatCard
            label="Average score"
            value={`${averageScore}%`}
            detail={`${autoSubmitted} auto-submitted attempts, ${totalViolations} total violations`}
            icon={Target}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Invitation funnel</CardTitle>
              <CardDescription>
                Candidate movement from invite creation to completed assessments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <HorizontalBar
                label="Invited candidates"
                value={100}
                detail={`${totalInvites} total`}
              />
              <HorizontalBar
                label="Active invites"
                value={totalInvites ? (activeInvites / totalInvites) * 100 : 0}
                detail={`${activeInvites} active`}
              />
              <HorizontalBar
                label="Submitted assessments"
                value={completionRate}
                detail={`${submittedInvites} submitted`}
              />
              <HorizontalBar
                label="Expired without submission"
                value={totalInvites ? (expiredInvites / totalInvites) * 100 : 0}
                detail={`${expiredInvites} expired`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Score distribution</CardTitle>
              <CardDescription>
                Submission quality grouped into easy-to-read score bands.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results.length ? (
                <ScoreDistribution results={results} />
              ) : isLoading ? (
                <ScoreDistributionSkeleton />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-md border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Score bands will appear after candidate submissions are available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Most invited assessments</CardTitle>
              <CardDescription>
                The roles currently receiving the most candidate traffic.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {topAssessments.map(({ job, stats }) => (
                <HorizontalBar
                  key={job.id}
                  label={job.title}
                  value={totalInvites ? (stats.invited / totalInvites) * 100 : 0}
                  detail={`${stats.invited} invites`}
                />
              ))}
              {!topAssessments.length ? (
                <div className="rounded-md border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Create assessments and send invitations to populate this chart.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Highest assessment averages</CardTitle>
              <CardDescription>
                Average scores by assessment for submitted candidate attempts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {highestAverage.map(({ job, stats }) => (
                <HorizontalBar
                  key={job.id}
                  label={job.title}
                  value={stats.averageScore}
                  detail={`${stats.averageScore}% avg`}
                />
              ))}
              {!highestAverage.length ? (
                <div className="rounded-md border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Assessment averages will appear once candidates submit tests.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="flex min-h-[560px] flex-col overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Candidate invitation tracker</CardTitle>
                  <CardDescription>
                    Recent job assessment invitations with clear expiry and submission state.
                  </CardDescription>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/admin/jobs">
                    Invite candidate
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-0">
              <div className="border-t px-4 py-3">
                <div className="relative max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={inviteSearch}
                    onChange={(event) => {
                      setInviteSearch(event.target.value);
                      setInvitePage(1);
                    }}
                    className="h-10 w-full rounded-md border bg-background px-3 pl-9 text-sm shadow-xs outline-none transition focus-visible:border-input focus-visible:ring-0"
                    placeholder="Search candidate, email, job, or status"
                    aria-label="Search candidate invitations"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Candidate</th>
                      <th className="px-4 py-3 font-medium">Job assessment</th>
                      <th className="px-4 py-3 font-medium">Invited</th>
                      <th className="px-4 py-3 font-medium">Expiry</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedInvites.map((invite) => {
                      const daysUntilExpiry = getDaysUntil(invite.inviteExpiresAt);
                      const linkedJob = invite.jobAssignmentId
                        ? publicJobsById.get(invite.jobAssignmentId)
                        : undefined;
                      return (
                        <tr key={invite.id} className="bg-background">
                          <td className="px-4 py-3">
                            <p className="font-medium">{invite.name}</p>
                            <p className="text-xs text-muted-foreground">{invite.email}</p>
                          </td>
                          <td className="px-4 py-3">{invite.jobTitle}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(invite.invitedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-muted-foreground">
                              {formatDate(invite.inviteExpiresAt)}
                            </p>
                            {!invite.submittedAt && !invite.isInviteExpired ? (
                              <p className="text-xs text-muted-foreground">
                                {daysUntilExpiry <= 1 ? "Due soon" : `${daysUntilExpiry} days left`}
                              </p>
                            ) : null}
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
                          <td className="px-4 py-3 text-right">
                            <Button
                              asChild={Boolean(linkedJob)}
                              size="sm"
                              variant="outline"
                              disabled={!linkedJob}
                            >
                              {linkedJob ? (
                                <Link href={`/admin/jobs/${linkedJob.slug}`}>
                                  Invite candidate
                                </Link>
                              ) : (
                                <span>Invite candidate</span>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {!pagedInvites.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          {dashboardInvites.length
                            ? "No invitations match your search."
                            : "Candidate assessment invites will appear here."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-auto">
                <PaginatedControls
                  page={currentInvitePage}
                  totalPages={inviteTotalPages}
                  onPageChange={setInvitePage}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational alerts</CardTitle>
              <CardDescription>
                Fast signals for the actions an admin should check first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Pending manual review",
                  value: pendingReview,
                  icon: Bell,
                  href: "/admin/submissions",
                },
                {
                  label: "Expired candidate invites",
                  value: expiredInvites,
                  icon: TimerReset,
                  href: "/admin/jobs",
                },
                {
                  label: "Auto-submitted attempts",
                  value: autoSubmitted,
                  icon: Clock3,
                  href: "/admin/submissions",
                },
                {
                  label: "Integrity violations",
                  value: totalViolations,
                  icon: ShieldAlert,
                  href: "/admin/submissions",
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 rounded-lg border p-4 transition hover:border-foreground/30 hover:bg-muted/35"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-md border bg-muted/35 p-2 text-muted-foreground">
                      <item.icon className="size-4" />
                    </span>
                    <span className="truncate text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                    {item.value}
                    <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-[560px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Assessment performance table</CardTitle>
            <CardDescription>
              Paginated assessment analytics with invitation volume, completion, score, and test structure.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex-1 overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Assessment</th>
                    <th className="px-4 py-3 font-medium">Invited</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium">Completion</th>
                    <th className="px-4 py-3 font-medium">Avg. score</th>
                    <th className="px-4 py-3 font-medium">Structure</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagedAssessments.map(({ job, stats }) => (
                    <tr key={job.id} className="bg-background align-top">
                      <td className="px-4 py-4">
                        <p className="font-medium">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.role} - created {formatDate(job.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4">{stats.invited}</td>
                      <td className="px-4 py-4">{stats.submissions}</td>
                      <td className="px-4 py-4">
                        <div className="w-36 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span>{formatPercent(stats.completionRate)}</span>
                            <span className="text-xs text-muted-foreground">
                              {stats.submissions}/{stats.invited || 0}
                            </span>
                          </div>
                          <Progress value={stats.completionRate} />
                        </div>
                      </td>
                      <td className="px-4 py-4">{stats.averageScore}%</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">{job.sectionCount} sections</Badge>
                          <Badge variant="outline">{job.questionsPerTest} questions</Badge>
                          <Badge variant="outline">{job.timePerSectionMinutes} min</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/assessment/${job.id}`}>
                            Open
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!pagedAssessments.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Assessments will appear here after setup.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="mt-auto">
              <PaginatedControls
                page={currentAssessmentPage}
                totalPages={assessmentTotalPages}
                onPageChange={setAssessmentPage}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {assessmentRows.slice(0, 3).map(({ job, stats }) => (
            <Link
              key={job.id}
              href={`/admin/assessment/${job.id}`}
              className={cn(
                "group rounded-lg border bg-card p-5 text-card-foreground shadow-xs transition",
                "hover:border-foreground/30 hover:bg-muted/35",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{job.role}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="font-semibold">{stats.invited}</p>
                  <p className="text-xs text-muted-foreground">Invited</p>
                </div>
                <div>
                  <p className="font-semibold">{stats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
                <div>
                  <p className="font-semibold">{stats.averageScore}%</p>
                  <p className="text-xs text-muted-foreground">Avg.</p>
                </div>
              </div>
              <Progress className="mt-4" value={stats.completionRate} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
