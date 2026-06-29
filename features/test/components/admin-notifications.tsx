"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Clock3, Inbox, Send } from "lucide-react";
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
import {
  fetchAdminDataSnapshot,
  type AssessmentResult,
  type Candidate,
  type JobAssessment,
} from "@/features/test/admin-storage";

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

const READ_NOTIFICATIONS_KEY = "kgm-hiring-admin-read-notifications";

function useAdminData() {
  const [adminData, setAdminData] = useState<AdminSnapshot>({});

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const data = await fetchAdminDataSnapshot();
        if (active) setAdminData({ candidates: data.candidates, results: data.results });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load notifications.");
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  return {
    candidates: adminData.candidates ?? [],
    jobs: adminData.jobs ?? [],
    results: adminData.results ?? [],
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildAdminNotifications(
  jobs: JobAssessment[],
  candidates: Candidate[],
  results: AssessmentResult[],
) {
  const resultNotifications: AdminNotification[] = results.map((result) => ({
    id: `result-${result.id}`,
    title: `${result.candidateName} submitted`,
    description: `${result.assessmentTitle} scored ${result.score}%`,
    time: formatDate(result.submittedAt),
    tone: result.status === "Auto submitted" ? "warning" : "success",
    href: `/admin/submissions/${result.id}`,
  }));
  const pendingInvites = candidates.filter(
    (candidate) =>
      !candidate.submittedAt &&
      !results.some((result) => result.candidateEmail === candidate.email),
  );
  const inviteNotifications: AdminNotification[] = pendingInvites.map((candidate) => ({
    id: `invite-${candidate.id}`,
    title: "Invite awaiting submission",
    description: `${candidate.name} has an active OTP`,
    time: formatDate(candidate.invitedAt),
    tone: "default",
    href: `/admin/assessment/${candidate.jobId}`,
  }));
  const assessmentNotifications: AdminNotification[] = jobs.map((job) => ({
    id: `assessment-${job.id}`,
    title: "Assessment available",
    description: `${job.role} is ready for candidate invites`,
    time: formatDate(job.createdAt),
    tone: "default",
    href: `/admin/assessment/${job.id}`,
  }));

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

export function AdminNotifications() {
  const { candidates, jobs, results } = useAdminData();
  const [readNotifications, setReadNotifications] = useState<string[]>(() =>
    readNotificationIds(),
  );
  const notifications = useMemo(
    () => buildAdminNotifications(jobs, candidates, results),
    [candidates, jobs, results],
  );
  const unreadCount = notifications.filter(
    (notification) => !readNotifications.includes(notification.id),
  ).length;

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
      <AdminNavbar />
      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 w-fit gap-2">
              <Bell className="size-3.5" />
              Notifications
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              Admin notifications
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review submission, invite, and assessment activity in one place.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={markAllNotificationsRead}
            disabled={!unreadCount}
          >
            Mark all read
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Unread", value: unreadCount, icon: Inbox },
            { label: "Submissions", value: results.length, icon: Send },
            { label: "Pending invites", value: candidates.filter((item) => !item.submittedAt).length, icon: Clock3 },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <Icon className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All updates</CardTitle>
            <CardDescription>Newest candidate and assessment events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification) => {
              const isRead = readNotifications.includes(notification.id);

              return (
                <div
                  key={notification.id}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{notification.title}</p>
                        {isRead ? (
                          <Badge variant="outline">Read</Badge>
                        ) : (
                          <Badge>New</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {notification.description}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {notification.time}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
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
                        disabled={isRead}
                        onClick={() => markNotificationRead(notification.id)}
                      >
                        <CheckCircle2 className="size-4" />
                        {isRead ? "Read" : "Mark read"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!notifications.length ? (
              <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
