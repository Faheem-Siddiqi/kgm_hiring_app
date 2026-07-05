"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  FileCheck2,
  Mail,
  Search,
  Target,
  X,
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
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

type DashboardJobStats = {
  invited: number;
  expectedSubmissions: number;
  submissions: number;
  completedInvites: number;
  activeInvites: number;
  expiredInvites: number;
  completionRate: number;
  averageScore: number;
  pendingReview: number;
  autoSubmitted: number;
  totalViolations: number;
  scoreBuckets: Record<string, number>;
};

type DashboardJobRow = {
  job: PublicJob;
  invited: number;
  expectedSubmissions: number;
  submissions: number;
  completedInvites: number;
  activeInvites: number;
  expiredInvites: number;
  averageScore: number;
  completionRate: number;
  pendingReview: number;
  autoSubmitted: number;
  totalViolations: number;
  scoreBuckets: Record<string, number>;
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
    scoreBuckets?: Record<string, number>;
    pendingReview?: number;
    autoSubmitted?: number;
    totalViolations?: number;
    jobStats?: Record<string, DashboardJobStats>;
    recentInvites?: DashboardInvite[];
  };
};

const READ_NOTIFICATIONS_KEY = "kgm-hiring-admin-read-notifications";
const TABLE_PAGE_SIZE = 6;
const JOB_GRAPH_LIMIT = 10;
const chartPanelClass =
  "rounded-md border bg-gradient-to-b from-muted/20 to-background p-3 shadow-xs sm:p-4";
const chartBarClass =
  "relative w-full rounded-t-md transition-[height,background-color,box-shadow,transform] duration-300 ease-out";
const chartScrollClass =
  "overflow-x-auto overflow-y-visible pb-3 [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent";

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

function useAdminData(enabled = true) {
  const [adminData, setAdminData] = useState<AdminSnapshot>({});
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function loadData() {
      try {
        const data = await fetchAdminDataSnapshot({ view: "analytics" });
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

const CHART_POPOVER_OPEN_EVENT = "kgm-chart-popover-open";

function ChartHoverPopover({
  title,
  rows,
  valueLabel,
}: {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    value: number;
    detail?: string;
    href?: string;
  }>;
  valueLabel: string;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverIdRef = useRef(
    `chart-popover-${Math.random().toString(36).slice(2)}`,
  );

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 16,
    top: 80,
  });

  const positiveRows = rows
    .filter((row) => row.value > 0)
    .sort((first, second) => second.value - first.value);

  const maxValue = Math.max(1, ...positiveRows.map((row) => row.value));

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function closePopover() {
    clearCloseTimer();
    setOpen(false);
  }

  function scheduleClose() {
    clearCloseTimer();

    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 90);
  }

  function updatePosition() {
    if (typeof window === "undefined") return;

    const trigger = anchorRef.current?.parentElement;

    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const popoverWidth = Math.min(320, window.innerWidth - margin * 2);
    const popoverMaxHeight = Math.min(360, window.innerHeight - margin * 2);

    const canOpenRight =
      rect.right + gap + popoverWidth <= window.innerWidth - margin;
    const canOpenLeft = rect.left - gap - popoverWidth >= margin;

    const left = canOpenRight
      ? rect.right + gap
      : canOpenLeft
        ? rect.left - gap - popoverWidth
        : Math.max(margin, (window.innerWidth - popoverWidth) / 2);

    const top = Math.min(
      Math.max(margin, rect.top),
      Math.max(margin, window.innerHeight - popoverMaxHeight - margin),
    );

    setPosition({ left, top });
  }

  function openPopover() {
    if (typeof window === "undefined") return;

    clearCloseTimer();
    updatePosition();

    window.dispatchEvent(
      new CustomEvent(CHART_POPOVER_OPEN_EVENT, {
        detail: popoverIdRef.current,
      }),
    );

    setOpen(true);
  }

  useEffect(() => {
    const trigger = anchorRef.current?.parentElement;

    if (!trigger) return;

    function handleMouseEnter() {
      openPopover();
    }

    function handleMouseLeave(event: MouseEvent) {
      const nextTarget = event.relatedTarget;

      if (
        nextTarget instanceof Node &&
        popoverRef.current?.contains(nextTarget)
      ) {
        return;
      }

      scheduleClose();
    }

    function handleFocusIn() {
      openPopover();
    }

    function handleFocusOut(event: FocusEvent) {
      const nextTarget = event.relatedTarget;

      if (
        nextTarget instanceof Node &&
        popoverRef.current?.contains(nextTarget)
      ) {
        return;
      }

      closePopover();
    }

    trigger.addEventListener("mouseenter", handleMouseEnter);
    trigger.addEventListener("mouseleave", handleMouseLeave);
    trigger.addEventListener("focusin", handleFocusIn);
    trigger.addEventListener("focusout", handleFocusOut);

    return () => {
      trigger.removeEventListener("mouseenter", handleMouseEnter);
      trigger.removeEventListener("mouseleave", handleMouseLeave);
      trigger.removeEventListener("focusin", handleFocusIn);
      trigger.removeEventListener("focusout", handleFocusOut);
      clearCloseTimer();
    };
  });

  useEffect(() => {
    function handleAnotherPopoverOpen(event: Event) {
      const customEvent = event as CustomEvent<string>;

      if (customEvent.detail !== popoverIdRef.current) {
        closePopover();
      }
    }

    window.addEventListener(
      CHART_POPOVER_OPEN_EVENT,
      handleAnotherPopoverOpen,
    );

    return () => {
      window.removeEventListener(
        CHART_POPOVER_OPEN_EVENT,
        handleAnotherPopoverOpen,
      );
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <span ref={anchorRef} aria-hidden="true" className="sr-only" />

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={closePopover}
              onWheel={(event) => event.stopPropagation()}
              className="fixed z-[80] w-[min(calc(100vw-1.5rem),20rem)] rounded-md border bg-card p-3 text-left text-card-foreground shadow-md"
              style={{
                left: position.left,
                top: position.top,
                maxHeight: "min(60vh, 360px)",
              }}
            >
              <p className="text-sm font-medium">{title}</p>

              <div className="mt-3 max-h-[calc(min(60vh,360px)-3rem)] space-y-2 overflow-y-auto pr-1">
                {positiveRows.length ? (
                  positiveRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-md border bg-background p-2.5"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium">
                          {row.title}
                        </span>

                        <span className="shrink-0 text-muted-foreground">
                          {row.value}
                          {valueLabel ? ` ${valueLabel}` : ""}
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{
                            width: `${Math.max(
                              5,
                              (row.value / maxValue) * 100,
                            )}%`,
                          }}
                        />
                      </div>

                      {row.detail ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {row.detail}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                    No matching job activity yet.
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function InteractiveInvitationFunnel({
  totalInvites,
  activeInvites,
  submittedInvites,
  expiredInvites,
  completionRate,
  jobRows,
}: {
  totalInvites: number;
  activeInvites: number;
  submittedInvites: number;
  expiredInvites: number;
  completionRate: number;
  jobRows: DashboardJobRow[];
}) {
  const [activeStage, setActiveStage] = useState("submitted");
  const stages = [
    {
      id: "invited",
      label: "Invited candidates",
      value: totalInvites,
      percent: 100,
      metric: (row: DashboardJobRow) => row.invited,
      detail: (row: DashboardJobRow) => `${row.activeInvites} active, ${row.expiredInvites} expired`,
    },
    {
      id: "active",
      label: "Active invites",
      value: activeInvites,
      percent: totalInvites ? (activeInvites / totalInvites) * 100 : 0,
      metric: (row: DashboardJobRow) => row.activeInvites,
      detail: (row: DashboardJobRow) => `${row.invited} total invites`,
    },
    {
      id: "submitted",
      label: "Submitted assessments",
      value: submittedInvites,
      percent: completionRate,
      metric: (row: DashboardJobRow) => row.submissions,
      detail: (row: DashboardJobRow) => `${row.completionRate}% completion`,
    },
    {
      id: "expired",
      label: "Expired without submission",
      value: expiredInvites,
      percent: totalInvites ? (expiredInvites / totalInvites) * 100 : 0,
      metric: (row: DashboardJobRow) => row.expiredInvites,
      detail: (row: DashboardJobRow) => `${row.activeInvites} still active`,
    },
  ];
  const selectedStage = stages.find((stage) => stage.id === activeStage) ?? stages[2];
  return (
    <div className={chartScrollClass}>
      <div className="grid min-w-[520px] gap-3 sm:grid-cols-2">
        {stages.map((stage) => {
          const active = stage.id === selectedStage.id;
          const stageRows = jobRows.map((row) => ({
            id: row.job.id,
            title: row.job.title,
            value: stage.metric(row),
            detail: stage.detail(row),
            href: `/admin/jobs/${row.job.slug}`,
          }));

          return (
            <button
              key={stage.id}
              type="button"
              onMouseEnter={() => setActiveStage(stage.id)}
              onFocus={() => setActiveStage(stage.id)}
              onClick={() => setActiveStage(stage.id)}
              className={cn(
                "group relative w-full rounded-md border p-3 text-left outline-none transition duration-200",
                active ? "border-foreground bg-muted/40 shadow-xs" : "hover:border-foreground/15 hover:bg-muted/25",
              )}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="text-muted-foreground">{stage.value}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-all duration-300 ease-out"
                  style={{ width: `${clampPercent(stage.percent)}%` }}
                />
              </div>
              <ChartHoverPopover
                title={`${stage.label} by job`}
                rows={stageRows}
                valueLabel="records"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ScoreBucket = {
  label: string;
  tone: string;
  count: number;
};

function ScoreDonutChart({
  buckets,
  activeBucket,
  onActiveBucketChange,
  getRows,
}: {
  buckets: ScoreBucket[];
  activeBucket: string;
  onActiveBucketChange: (bucket: string) => void;
  getRows?: (bucketLabel: string) => Array<{ id: string; title: string; value: number; detail?: string }>;
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const colors = [
    "hsl(var(--muted-foreground) / 0.45)",
    "hsl(var(--muted-foreground) / 0.7)",
    "hsl(var(--foreground) / 0.72)",
    "hsl(var(--foreground))",
  ];
  let start = 0;
  const gradient = total
    ? buckets
        .map((bucket, index) => {
          const size = (bucket.count / total) * 360;
          const segment = `${colors[index]} ${start}deg ${start + size}deg`;
          start += size;
          return segment;
        })
        .join(", ")
    : "hsl(var(--muted)) 0deg 360deg";
  const selectedBucket = buckets.find((bucket) => bucket.label === activeBucket) ?? buckets[3];

  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:items-center">
      <div className="relative mx-auto flex size-56 items-center justify-center rounded-full border bg-muted/20 p-4 shadow-xs">
        <div
          className="size-full rounded-full transition-all duration-300"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute flex size-32 flex-col items-center justify-center rounded-full border bg-background text-center shadow-xs">
          <p className="text-2xl font-semibold">{selectedBucket.count}</p>
          <p className="text-xs text-muted-foreground">{selectedBucket.label}%</p>
          <p className="mt-1 max-w-24 truncate text-xs text-muted-foreground">
            {selectedBucket.tone}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {buckets.map((bucket, index) => {
          const active = selectedBucket.label === bucket.label;
          const rows = getRows?.(bucket.label) ?? [
            {
              id: bucket.label,
              title: bucket.tone,
              value: bucket.count,
              detail: `${bucket.count} submissions in this band`,
            },
          ];

          return (
            <button
              key={bucket.label}
              type="button"
              onMouseEnter={() => onActiveBucketChange(bucket.label)}
              onFocus={() => onActiveBucketChange(bucket.label)}
              onClick={() => onActiveBucketChange(bucket.label)}
              className={cn(
                "group relative rounded-md border p-3 text-left outline-none transition hover:bg-muted/30",
                active && "border-foreground bg-muted/35",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colors[index] }}
                  />
                  {bucket.label}%
                </span>
                <span className="text-sm text-muted-foreground">{bucket.count}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{bucket.tone}</p>
              <ChartHoverPopover
                title={`${bucket.label}% band`}
                rows={rows}
                valueLabel={getRows ? "submissions" : ""}
              />
            </button>
          );
        })}
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

  return (
    <div className="space-y-3">
      <ScoreDonutChart
        buckets={buckets}
        activeBucket={activeBucket}
        onActiveBucketChange={setActiveBucket}
      />
    </div>
  );
}

function AggregatedScoreDistribution({
  scoreBuckets,
  jobRows,
}: {
  scoreBuckets: Record<string, number>;
  jobRows: DashboardJobRow[];
}) {
  const [activeBucket, setActiveBucket] = useState("80-100");
  const buckets = [
    { label: "0-39", tone: "Needs review" },
    { label: "40-59", tone: "Developing" },
    { label: "60-79", tone: "Qualified" },
    { label: "80-100", tone: "Strong" },
  ].map((bucket) => ({
    ...bucket,
    count: scoreBuckets[bucket.label] ?? 0,
  }));
  return (
    <div className="space-y-3">
      <ScoreDonutChart
        buckets={buckets}
        activeBucket={activeBucket}
        onActiveBucketChange={setActiveBucket}
        getRows={(bucketLabel) =>
          jobRows.map((row) => ({
            id: row.job.id,
            title: row.job.title,
            value: row.scoreBuckets[bucketLabel] ?? 0,
            detail: `${row.averageScore}% average score`,
          }))
        }
      />
    </div>
  );
}

function DashboardSkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

function OperationalAlertsGraph({
  pendingReview,
  expiredInvites,
  autoSubmitted,
  totalViolations,
  jobRows,
}: {
  pendingReview: number;
  expiredInvites: number;
  autoSubmitted: number;
  totalViolations: number;
  jobRows: DashboardJobRow[];
}) {
  const [activeAlert, setActiveAlert] = useState("pending");
  const alerts = [
    {
      id: "pending",
      label: "Pending manual review",
      value: pendingReview,
      href: "/admin/submissions",
      metric: (row: DashboardJobRow) => row.pendingReview,
      detail: (row: DashboardJobRow) => `${row.submissions} submissions`,
    },
    {
      id: "expired",
      label: "Expired candidate invites",
      value: expiredInvites,
      href: "/admin/jobs",
      metric: (row: DashboardJobRow) => row.expiredInvites,
      detail: (row: DashboardJobRow) => `${row.invited} total invites`,
    },
    {
      id: "auto",
      label: "Auto-submitted attempts",
      value: autoSubmitted,
      href: "/admin/submissions",
      metric: (row: DashboardJobRow) => row.autoSubmitted,
      detail: (row: DashboardJobRow) => `${row.submissions} submissions`,
    },
    {
      id: "violations",
      label: "Integrity violations",
      value: totalViolations,
      href: "/admin/submissions",
      metric: (row: DashboardJobRow) => row.totalViolations,
      detail: (row: DashboardJobRow) => `${row.autoSubmitted} auto-submitted`,
    },
  ];
  const maxValue = Math.max(1, ...alerts.map((alert) => alert.value));
  const selectedAlert = alerts.find((alert) => alert.id === activeAlert) ?? alerts[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational alerts</CardTitle>
        <CardDescription>
          Fast signals for the actions an admin should check first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={chartScrollClass}>
          <div className={cn("grid h-72 min-w-[520px] grid-cols-4 items-end gap-3", chartPanelClass)}>
            {alerts.map((alert) => {
              const active = alert.id === selectedAlert.id;
              const alertRows = jobRows.map((row) => ({
                id: row.job.id,
                title: row.job.title,
                value: alert.metric(row),
                detail: alert.detail(row),
                href: `/admin/jobs/${row.job.slug}`,
              }));

              return (
                <button
                  key={alert.id}
                  type="button"
                  onMouseEnter={() => setActiveAlert(alert.id)}
                  onFocus={() => setActiveAlert(alert.id)}
                  onClick={() => setActiveAlert(alert.id)}
                  className="group relative flex h-full flex-col justify-end gap-2 rounded-md outline-none"
                >
                  <div className="flex min-h-0 flex-1 items-end">
                    <div
                      className={cn(
                        chartBarClass,
                        active
                          ? "bg-foreground shadow-lg shadow-foreground/15"
                          : "bg-foreground/35 group-hover:bg-foreground/70 group-hover:shadow-sm",
                      )}
                      style={{
                        height: `${alert.value ? Math.max(10, (alert.value / maxValue) * 100) : 4}%`,
                      }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">{alert.value}</p>
                    <p className="mx-auto max-w-20 text-balance text-[11px] leading-4 text-muted-foreground">
                      {alert.label}
                    </p>
                  </div>
                  <ChartHoverPopover
                    title={alert.label}
                    rows={alertRows}
                    valueLabel="items"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobSubmissionRateGraph({ jobRows }: { jobRows: DashboardJobRow[] }) {
  const [activeJobId, setActiveJobId] = useState(jobRows[0]?.job.id ?? "");
  const sortedRows = [...jobRows]
    .sort((first, second) => second.completionRate - first.completionRate)
    .slice(0, JOB_GRAPH_LIMIT);
  const hiddenJobCount = Math.max(0, jobRows.length - sortedRows.length);
  const selectedRow =
    sortedRows.find((row) => row.job.id === activeJobId) ?? sortedRows[0];
  const chartWidth = Math.max(520, sortedRows.length * 88);
  const chartHeight = 240;
  const points = sortedRows.map((row, index) => {
    const x =
      sortedRows.length <= 1
        ? chartWidth / 2
        : 44 + (index / (sortedRows.length - 1)) * (chartWidth - 88);
    const y = 28 + (1 - clampPercent(row.completionRate) / 100) * (chartHeight - 86);
    return { row, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>All jobs submission rate</CardTitle>
            <CardDescription>
              Completion rate by job based on expected assigned assessment submissions.
            </CardDescription>
          </div>
          {hiddenJobCount ? (
            <Badge variant="outline" className="w-fit">
              Showing top {sortedRows.length} of {jobRows.length}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className={chartScrollClass}>
          <div className={cn("relative min-w-[520px]", chartPanelClass)} style={{ width: chartWidth }}>
            <svg
              className="h-72 w-full overflow-visible"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label="Job completion rate line chart"
            >
              <line
                x1="32"
                x2={chartWidth - 32}
                y1={chartHeight - 48}
                y2={chartHeight - 48}
                className="stroke-border"
                strokeWidth="1"
              />
              {[25, 50, 75, 100].map((tick) => {
                const y = 28 + (1 - tick / 100) * (chartHeight - 86);
                return (
                  <g key={tick}>
                    <line
                      x1="32"
                      x2={chartWidth - 32}
                      y1={y}
                      y2={y}
                      className="stroke-border/60"
                      strokeDasharray="4 6"
                      strokeWidth="1"
                    />
                    <text
                      x="4"
                      y={y + 4}
                      className="fill-muted-foreground text-[10px]"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}
              {points.length ? (
                <polyline
                  fill="none"
                  points={linePoints}
                  className="stroke-foreground"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
              ) : null}
            </svg>
            {points.map(({ row, x, y }) => {
              const active = selectedRow?.job.id === row.job.id;
              const jobPopoverRows = [
                {
                  id: `${row.job.id}-submissions`,
                  title: "Expected submissions",
                  value: row.expectedSubmissions,
                  detail: `${row.submissions} completed`,
                },
                {
                  id: `${row.job.id}-invites`,
                  title: "Invites",
                  value: row.invited,
                  detail: `${row.activeInvites} active, ${row.expiredInvites} expired`,
                },
                {
                  id: `${row.job.id}-score`,
                  title: "Average score",
                  value: row.averageScore,
                  detail: `${row.averageScore}% average score`,
                },
              ];

              return (
                <button
                  key={row.job.id}
                  type="button"
                  onMouseEnter={() => setActiveJobId(row.job.id)}
                  onFocus={() => setActiveJobId(row.job.id)}
                  onClick={() => setActiveJobId(row.job.id)}
                  className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
                  style={{ left: x, top: y }}
                  aria-label={`${row.job.title} completion rate is ${row.completionRate} percent`}
                  title={row.job.title}
                >
                  <span
                    className={cn(
                      "block size-4 rounded-full border-2 border-background ring-2 transition",
                      active
                        ? "bg-foreground ring-foreground"
                        : "bg-muted-foreground ring-muted-foreground/35 group-hover:bg-foreground group-hover:ring-foreground",
                    )}
                  />
                  <span className="absolute left-1/2 top-5 w-20 -translate-x-1/2 text-center text-[10px] font-medium text-muted-foreground">
                    {row.completionRate}%
                  </span>
                  <ChartHoverPopover
                    title={row.job.title}
                    rows={jobPopoverRows}
                    valueLabel=""
                  />
                </button>
              );
            })}
            {!points.length ? (
              <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground">
                Jobs will appear after setup.
              </div>
            ) : null}
            {hiddenJobCount ? (
              <div className="border-t pt-3 text-xs text-muted-foreground">
                Showing the highest completion rates so the chart stays readable when many jobs exist.
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
        <div className="grid gap-6 lg:grid-cols-2">
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
        <div className="grid gap-6 xl:grid-cols-2">
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
  const [jobPage, setJobPage] = useState(1);
  const [jobSearch, setJobSearch] = useState("");
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
  const pendingReview = results.length
    ? results.filter((result) => !result.decision && !result.evaluatedAt).length
    : initialHiringStats?.pendingReview ?? 0;
  const autoSubmitted = results.length
    ? results.filter((result) => result.status === "Auto submitted").length
    : initialHiringStats?.autoSubmitted ?? 0;
  const totalViolations = results.length
    ? results.reduce((total, result) => total + result.violations.length, 0)
    : initialHiringStats?.totalViolations ?? 0;
  const jobsWithAssessments = initialPublicJobs.filter(
    (job) => job.assessmentIds.length,
  ).length;
  const jobCoverage = publicJobCount
      ? Math.round((jobsWithAssessments / publicJobCount) * 100)
      : 0;
  const assessmentStatsById = new Map(
    dashboardJobs.map((job) => [
      job.id,
      getAssessmentStats(job, candidates, results, initialHiringStats),
    ]),
  );
  const jobRows = initialPublicJobs.map((job) => {
    const serverStats = initialHiringStats?.jobStats?.[job.id];

    if (serverStats) {
      return {
        job,
        ...serverStats,
      };
    }

    const relatedStats = job.assessmentIds.map((id) => assessmentStatsById.get(id));
    const invited = relatedStats.reduce((total, stats) => total + (stats?.invited ?? 0), 0);
    const submissions = relatedStats.reduce((total, stats) => total + (stats?.submissions ?? 0), 0);
    const averageScoreStats = relatedStats.filter((stats) => stats?.submissions);
    const averageScore = averageScoreStats.length
      ? Math.round(
          averageScoreStats.reduce((total, stats) => total + (stats?.averageScore ?? 0), 0) /
            averageScoreStats.length,
        )
      : 0;
    const completionRate = invited ? Math.round((submissions / invited) * 100) : 0;

    return {
      job,
      invited,
      expectedSubmissions: invited,
      submissions,
      completedInvites: submissions,
      activeInvites: 0,
      expiredInvites: 0,
      averageScore,
      completionRate,
      pendingReview: 0,
      autoSubmitted: 0,
      totalViolations: 0,
      scoreBuckets: {},
    };
  }) satisfies DashboardJobRow[];
  const filteredJobRows = jobRows.filter(({ job }) => {
    const query = jobSearch.trim().toLowerCase();

    if (!query) return true;

    return [
      job.title,
      job.department,
      job.location,
      job.experience,
      job.status,
      ...job.assessments.flatMap((assessment) => [
        assessment.name,
        assessment.code,
        assessment.questionBankName,
      ]),
    ].some((value) => value.toLowerCase().includes(query));
  });
  const jobTotalPages = Math.max(1, Math.ceil(filteredJobRows.length / TABLE_PAGE_SIZE));
  const currentJobPage = Math.min(jobPage, jobTotalPages);
  const pagedJobs = filteredJobRows.slice(
    (currentJobPage - 1) * TABLE_PAGE_SIZE,
    currentJobPage * TABLE_PAGE_SIZE,
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
        <div className="grid gap-6 lg:grid-cols-2">
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

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Invitation funnel</CardTitle>
              <CardDescription>
                Candidate movement from invite creation to completed assessments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <InteractiveInvitationFunnel
                totalInvites={totalInvites}
                activeInvites={activeInvites}
                submittedInvites={submittedInvites}
                expiredInvites={expiredInvites}
                completionRate={completionRate}
                jobRows={jobRows}
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
              {initialHiringStats?.scoreBuckets ? (
                <AggregatedScoreDistribution
                  scoreBuckets={initialHiringStats.scoreBuckets}
                  jobRows={jobRows}
                />
              ) : results.length ? (
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
          <OperationalAlertsGraph
            pendingReview={pendingReview}
            expiredInvites={expiredInvites}
            autoSubmitted={autoSubmitted}
            totalViolations={totalViolations}
            jobRows={jobRows}
          />
          <JobSubmissionRateGraph jobRows={jobRows} />
        </div>

        <div className="grid gap-6">
          <Card className="flex min-h-[560px] flex-col overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Jobs overview</CardTitle>
                  <CardDescription>
                    Search published jobs, review attached assessments, and open the invite workflow.
                  </CardDescription>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/admin/jobs">
                    Manage jobs
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
                    value={jobSearch}
                    onChange={(event) => {
                      setJobSearch(event.target.value);
                      setJobPage(1);
                    }}
                    className="h-10 w-full rounded-md border bg-background px-3 pl-9 text-sm shadow-xs outline-none transition focus-visible:border-input focus-visible:ring-0"
                    placeholder="Search job, department, status, or assessment"
                    aria-label="Search jobs"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Job</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Assessments</th>
                      <th className="px-4 py-3 font-medium">Invites</th>
                      <th className="px-4 py-3 font-medium">Completion</th>
                      <th className="px-4 py-3 font-medium">Avg. score</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedJobs.map(({ job, invited, submissions, averageScore, completionRate }) => (
                      <tr key={job.id} className="bg-background align-top">
                        <td className="px-4 py-4">
                          <p className="font-medium">{job.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.location} - {job.experience}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{job.department}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {job.assessments.length ? (
                              job.assessments.map((assessment) => (
                                <Badge key={assessment.id} variant="outline">
                                  {assessment.code}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">Not assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">{invited}</td>
                        <td className="px-4 py-4">
                          <div className="w-36 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span>{formatPercent(completionRate)}</span>
                              <span className="text-xs text-muted-foreground">
                                {submissions}/{invited || 0}
                              </span>
                            </div>
                            <Progress value={completionRate} />
                          </div>
                        </td>
                        <td className="px-4 py-4">{averageScore}%</td>
                        <td className="px-4 py-4">
                          <Badge variant={job.status === "open" || job.status === "reopened" ? "default" : "outline"}>
                            {job.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/jobs/${job.slug}`}>
                              Open
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!pagedJobs.length ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          {initialPublicJobs.length
                            ? "No jobs match your search."
                            : "Jobs will appear here after setup."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-auto">
                <PaginatedControls
                  page={currentJobPage}
                  totalPages={jobTotalPages}
                  onPageChange={setJobPage}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
  