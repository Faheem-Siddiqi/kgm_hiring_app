"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardList,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCircle,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";







import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import lightLogo from "@/src/assets/LightLogo.png";







type AdminNavbarProps = {
  notificationCount?: number;
  notificationsOpen?: boolean;
  notificationPanel?: ReactNode;
  onToggleNotifications?: () => void;
};

type HiringRecordNotification = {
  id: string;
  title: string;
  description: string;
  time: string;
  href: string;
  tone: "default" | "warning" | "success";
};

type HiringRecordsResponse = {
  candidates?: Array<{
    id: string;
    name: string;
    jobId: string;
    invitedAt: string;
    submittedAt?: string;
  }>;
  results?: Array<{
    id: string;
    candidateName: string;
    assessmentTitle: string;
    score: number;
    status: "Submitted" | "Auto submitted";
    submittedAt: string;
  }>;
};

type CandidateApplicationsResponse = {
  applications?: Array<{
    id: string;
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    decisionStatus: "pending" | "invited" | "rejected";
    createdAt: string;
  }>;
};

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Assessments", href: "/admin/assessments", icon: ClipboardList },
  { label: "Jobs", href: "/admin/jobs", icon: BriefcaseBusiness },
  { label: "Applications", href: "/admin/candidate-applications", icon: ClipboardCheck },
  { label: "Submissions", href: "/admin/submissions", icon: Files },
];

function isActive(pathname: string, href: string) {
  const [path] = href.split("#");

  if (path === "/admin") {
    return pathname === "/admin";
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildNotifications(records: HiringRecordsResponse) {
  const resultNotifications: HiringRecordNotification[] = (records.results ?? [])
    .slice(0, 8)
    .map((result) => ({
      id: `result-${result.id}`,
      title: `${result.candidateName} submitted`,
      description: `${result.assessmentTitle} scored ${result.score}%`,
      time: formatNotificationDate(result.submittedAt),
      href: `/admin/submissions/${result.id}`,
      tone: result.status === "Auto submitted" ? "warning" : "success",
    }));
  const inviteNotifications: HiringRecordNotification[] = (records.candidates ?? [])
    .filter((candidate) => !candidate.submittedAt)
    .slice(0, 5)
    .map((candidate) => ({
      id: `invite-${candidate.id}`,
      title: "Invite awaiting submission",
      description: `${candidate.name} has an active assessment invite`,
      time: formatNotificationDate(candidate.invitedAt),
      href: `/admin/assessment/${candidate.jobId}`,
      tone: "default",
    }));

  return [...resultNotifications, ...inviteNotifications];
}

function buildApplicationNotifications(records: CandidateApplicationsResponse) {
  return (records.applications ?? [])
    .filter((application) => application.decisionStatus === "pending")
    .slice(0, 6)
    .map((application) => ({
      id: `application-${application.id}`,
      title: "New job application",
      description: `${application.candidateName} applied for ${application.jobTitle}`,
      time: formatNotificationDate(application.createdAt),
      href: `/admin/candidate-applications/${application.id}`,
      tone: "warning" as const,
    }));
}

export function AdminNavbar({
  notificationCount = 0,
  notificationsOpen = false,
  notificationPanel,
  onToggleNotifications,
}: AdminNavbarProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localNotificationsOpen, setLocalNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HiringRecordNotification[]>([]);
  const controlledNotifications = Boolean(onToggleNotifications);
  const openNotifications = controlledNotifications
    ? notificationsOpen
    : localNotificationsOpen;
  const notificationItems = useMemo(() => notifications.slice(0, 6), [notifications]);
  const visibleNotificationCount = controlledNotifications
    ? notificationCount
    : notifications.length;

  useEffect(() => {
    if (controlledNotifications) return;

    let active = true;

    async function loadNotifications() {
      try {
        const [recordsResponse, applicationsResponse] = await Promise.all([
          fetch("/api/admin/hiring-records", { cache: "no-store" }),
          fetch("/api/admin/candidate-applications", { cache: "no-store" }),
        ]);
        if (!recordsResponse.ok) return;
        const records = (await recordsResponse.json()) as HiringRecordsResponse;
        const applications = applicationsResponse.ok
          ? ((await applicationsResponse.json()) as CandidateApplicationsResponse)
          : {};
        if (active) {
          setNotifications([
            ...buildApplicationNotifications(applications),
            ...buildNotifications(records),
          ]);
        }
      } catch {
        if (active) setNotifications([]);
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, [controlledNotifications]);

  async function handleSignOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.assign("/admin/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="flex min-w-0 justify-center items-center gap-1 font-semibold">
          <span className="shrink-0 items-center justify-center ">
            <Image
              src={lightLogo}
              alt="KGM hiring workspace logo"
              className="size-6 grayscale object-contain"
              priority
            />
          </span>
          <span className="truncate mt-[0.25rem]">KGM Hiring Workspace</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Button
              key={href}
              asChild
              variant={isActive(pathname, href) ? "secondary" : "ghost"}
              size="sm"
            >
              <Link href={href}>
                <Icon className="size-4" />
                {label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              aria-label="Open admin notifications"
              size="icon"
              variant={openNotifications ? "secondary" : "outline"}
              onClick={
                onToggleNotifications ??
                (() => setLocalNotificationsOpen((value) => !value))
              }
            >
              <Bell className="size-4" />
              {visibleNotificationCount ? (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {visibleNotificationCount}
                </span>
              ) : null}
            </Button>
            {openNotifications ? (
              notificationPanel ?? (
                <div className="absolute right-0 top-11 z-30 max-h-[min(75vh,640px)] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg sm:w-96">
                  <div className="flex items-start justify-between gap-3 border-b p-3">
                    <div>
                      <p className="font-medium">Notifications</p>
                      <p className="text-xs text-muted-foreground">
                        {notifications.length} admin updates
                      </p>
                    </div>
                    <Button
                      aria-label="Close notifications"
                      size="icon"
                      variant="ghost"
                      onClick={() => setLocalNotificationsOpen(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="max-h-[calc(min(75vh,640px)-116px)] space-y-2 overflow-y-auto p-3">
                    {notificationItems.map((notification) => (
                      <div key={notification.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <span className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {notification.tone === "warning"
                              ? "Review"
                              : notification.tone === "success"
                                ? "New"
                                : "Info"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notification.description}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {notification.time}
                        </p>
                        <Button asChild size="sm" variant="outline" className="mt-3">
                          <Link
                            href={notification.href}
                            onClick={() => setLocalNotificationsOpen(false)}
                          >
                            Open
                          </Link>
                        </Button>
                      </div>
                    ))}
                    {!notificationItems.length ? (
                      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                        No notifications yet.
                      </div>
                    ) : null}
                  </div>
                  <div className="border-t p-3">
                    <Button asChild className="w-full" variant="outline">
                      <Link
                        href="/admin/notifications"
                        onClick={() => setLocalNotificationsOpen(false)}
                      >
                        View all notifications
                      </Link>
                    </Button>
                  </div>
                </div>
              )
            ) : null}
          </div>
          <ThemeToggle />
          <Button
            aria-label="Toggle navigation"
            className="md:hidden"
            size="icon"
            variant="outline"
            onClick={() => setNavOpen((value) => !value)}
          >
            {navOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
          <div className="relative">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Open admin account menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((value) => !value)}
            >
              <UserCircle className="size-5" />
            </Button>
            {profileOpen ? (
              <div className="absolute right-0 top-11 z-30 w-52 rounded-lg border bg-card p-2 text-card-foreground shadow-lg">
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                  <Link href="/admin/settings" onClick={() => setProfileOpen(false)}>
                    <Settings className="size-4" />
                    Settings
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {navOpen ? (
        <div className="border-t bg-background px-4 py-3 md:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            {navItems.map(({ label, href, icon: Icon }) => (
              <Button
                key={href}
                asChild
                variant={isActive(pathname, href) ? "secondary" : "ghost"}
                className={cn("justify-start", isActive(pathname, href) && "font-semibold")}
                onClick={() => setNavOpen(false)}
              >
                <Link href={href}>
                  <Icon className="size-4" />
                  {label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
