"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  PauseCircle,
  PlayCircle,
  Trash2,
  Grid2X2,
  LayoutDashboard,
  List,
  LogOut,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";


import { ThemeToggle } from "@/components/theme/theme-toggle";
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
import { cn } from "@/lib/utils";


type AdminUser = {
  id: string;
  name: string;
  designation: string;
  email: string;
  role: "main-admin" | "sub-admin";
  isAdmin: boolean;
  paused?: boolean;
  mustChangePassword: boolean;
  temporaryPasswordBackup?: string;
  invitationExpiresAt?: string;
  createdAt: string;
};

type AdminUsersResponse = {
  currentAdminEmail: string;
  currentAdminRole: AdminUser["role"];
  canManageAdmins: boolean;
  canModerateAdmins: boolean;
  canViewFallbackCredentials: boolean;
  sessionExpiresAt: string;
  users: AdminUser[];
};

type CreateAdminResponse = {
  user?: AdminUser;
  temporaryPassword?: string | null;
  setupLinkSent?: boolean;
  mail?: {
    sent: boolean;
    reason: string | null;
  };
  message?: string;
};

type ViewMode = "table" | "cards";

const PAGE_SIZE = 8;
const NO_INPUT_FOCUS_CLASS =
  "focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs";
function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0]}` : words[0]?.slice(0, 2))
    ?.toUpperCase() || "AD";
}

function AdminAvatar({ user, size = "md" }: { user: AdminUser; size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-medium tracking-tight ring-1 ring-inset",
        size === "sm" ? "size-9 text-xs" : "size-11 text-sm",
        user.role === "main-admin"
          ? "bg-foreground text-background ring-foreground/10"
          : "bg-muted text-foreground ring-border",
      )}
      aria-hidden="true"
    >
      {getInitials(user.name)}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(user: AdminUser) {
  if (user.paused) {
    return "Paused";
  }

  return user.mustChangePassword ? "Setup pending" : "Active";
}

function getRoleLabel(user: AdminUser) {
  if (user.role === "main-admin") {
    return "Main admin";
  }

  return user.designation.trim().toLowerCase() === "it administrator"
    ? "IT admin"
    : "Admin";
}

function StatusChip({ user }: { user: AdminUser }) {
  return (
    <Badge
      variant="outline"
      className="h-6 gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground"
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          user.paused
            ? "bg-muted-foreground"
            : user.mustChangePassword
              ? "bg-sky-500"
              : "bg-emerald-500",
        )}
      />
      {getStatusLabel(user)}
    </Badge>
  );
}

function AdminListSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "cards") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-md border p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/5 rounded bg-muted" />
                <div className="h-3 w-3/5 rounded bg-muted" />
                <div className="h-3 w-4/5 rounded bg-muted" />
              </div>
              <div className="h-6 w-16 rounded bg-muted" />
            </div>
            <div className="mt-5 flex gap-2 border-t pt-3">
              <div className="h-6 w-20 rounded bg-muted" />
              <div className="h-6 w-24 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_0.7fr] gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-3 w-20 animate-pulse rounded bg-muted" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid animate-pulse grid-cols-[minmax(0,1.5fr)_1fr_0.7fr] items-center gap-4 border-b px-4 py-4 last:border-0"
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 rounded bg-muted" />
              <div className="h-3 w-3/5 rounded bg-muted" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded bg-muted" />
            <div className="h-6 w-20 rounded bg-muted" />
          </div>
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function AdminSettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading admin settings" aria-busy="true">
      <div className="space-y-3">
        <div className="h-8 w-36 rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-7 w-32 rounded-md bg-muted" />
          <div className="h-7 w-24 rounded-md bg-muted" />
        </div>
        <div className="h-10 w-64 max-w-full rounded-md bg-muted" />
        <div className="h-4 w-full max-w-xl rounded bg-muted" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="rounded-xl border p-6">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="mt-3 h-4 w-full rounded bg-muted" />
          <div className="mt-8 space-y-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-10 w-full rounded-md bg-muted" />
              </div>
            ))}
            <div className="h-10 w-full rounded-md bg-muted" />
          </div>
        </div>
        <div className="rounded-xl border p-5">
          <div className="flex items-center justify-between gap-4 border-b pb-5">
            <div className="space-y-2">
              <div className="h-6 w-36 rounded bg-muted" />
              <div className="h-4 w-72 max-w-full rounded bg-muted" />
            </div>
            <div className="h-10 w-48 rounded-md bg-muted" />
          </div>
          <div className="my-4 h-10 w-full rounded-md bg-muted" />
          <AdminListSkeleton viewMode="table" />
        </div>
      </div>
    </div>
  );
}

export function AdminSettings() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [canModerateAdmins, setCanModerateAdmins] = useState(false);
  const [canViewFallbackCredentials, setCanViewFallbackCredentials] =
    useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [fallbackPassword, setFallbackPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionUserId, setActionUserId] = useState("");

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.designation,
        getRoleLabel(user),
        getStatusLabel(user),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [searchQuery, users]);
  const sortedUsers = useMemo(
    () =>
      [...filteredUsers].sort((first, second) => {
        if (first.role !== second.role) {
          return first.role === "main-admin" ? -1 : 1;
        }

        return first.name.localeCompare(second.name);
      }),
    [filteredUsers],
  );
  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedUsers = sortedUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadUsers() {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch("/api/admin/users", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as AdminUsersResponse & {
          message?: string;
        };

        if (!isMounted) return;

        if (!response.ok) {
          setMessage(result.message ?? "Could not load admin settings.");
          return;
        }

        setUsers(result.users);
        setCanManageAdmins(result.canManageAdmins);
        setCanModerateAdmins(result.canModerateAdmins);
        setCanViewFallbackCredentials(result.canViewFallbackCredentials);
      } catch (error) {
        if (isMounted && !(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Could not load admin settings", error);
          setMessage("Could not load admin settings.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }

    }

    void loadUsers();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("");
    setFallbackPassword("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, designation, email }),
    });
    const result = (await response.json()) as CreateAdminResponse;

    if (!response.ok || !result.user) {
      const nextMessage = result.message ?? "Could not add admin.";
      setMessage(nextMessage);
      toast.error(nextMessage);
      setIsSubmitting(false);
      return;
    }

    setUsers((current) => [...current, result.user as AdminUser]);
    setName("");
    setDesignation("");
    setEmail("");
    setPage(1);

    if (result.setupLinkSent) {
      const nextMessage = "Admin added. Password setup link sent by email.";
      setMessage(nextMessage);
      toast.success(nextMessage);
    } else {
      const nextMessage =
        "Admin added successfully. Email delivery is unavailable right now, so you can send the login details manually.";
      setMessage(nextMessage);
      setFallbackPassword(result.temporaryPassword ?? "");
      toast.success("Admin added. Use the manual login details below.");
    }

    setIsSubmitting(false);
  }

  async function handleSignOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.assign("/admin/login");
  }

  async function handlePauseToggle(user: AdminUser) {
    setActionUserId(user.id);

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, paused: !user.paused }),
    });
    const result = (await response.json()) as { user?: AdminUser; message?: string };

    if (!response.ok || !result.user) {
      toast.error(result.message ?? "Could not update admin account.");
      setActionUserId("");
      return;
    }

    setUsers((current) =>
      current.map((admin) => (admin.id === result.user?.id ? result.user : admin)),
    );
    toast.success(result.user.paused ? "Admin paused." : "Admin restored.");
    setActionUserId("");
  }

  async function handleDelete(user: AdminUser) {
    const confirmed = window.confirm(`Delete ${user.name}? This removes admin access.`);

    if (!confirmed) {
      return;
    }

    setActionUserId(user.id);

    const response = await fetch(
      `/api/admin/users?userId=${encodeURIComponent(user.id)}`,
      { method: "DELETE" },
    );
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      toast.error(result.message ?? "Could not delete admin account.");
      setActionUserId("");
      return;
    }

    setUsers((current) => current.filter((admin) => admin.id !== user.id));
    toast.success("Admin deleted.");
    setActionUserId("");
  }

  function renderFallbackPassword(user: AdminUser) {
    if (!user.temporaryPasswordBackup) {
      return null;
    }

    return (
      <div className=" pt-2 px-5">
        <p className="text-sm font-medium">Manual sign-in details</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Share this first-time password through a secure channel.
        </p>
        {canViewFallbackCredentials ? (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-muted/50 p-1 pl-3">
            <code className="min-w-0 flex-1 break-all text-sm font-semibold">
              {user.temporaryPasswordBackup}
            </code>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 rounded-md"
              title="Copy first-time password"
              aria-label={`Copy first-time password for ${user.name}`}
              onClick={() => {
                void navigator.clipboard.writeText(user.temporaryPasswordBackup ?? "");
                toast.success("First-time password copied.");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Ask the main administrator to share the first-time password.
          </p>
        )}
      </div>
    );
  }

  function renderAdminActions(user: AdminUser) {
    if (!canModerateAdmins || user.role === "main-admin") {
      return null;
    }

    const isWorking = actionUserId === user.id;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isWorking}
          onClick={() => void handlePauseToggle(user)}
        >
          {user.paused ? (
            <PlayCircle className="size-4" />
          ) : (
            <PauseCircle className="size-4" />
          )}
          {user.paused ? "Resume" : "Pause"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={isWorking}
          onClick={() => void handleDelete(user)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex min-w-0 items-center gap-2 font-semibold">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card">
              <ShieldCheck className="size-4" />
            </span>
            <span className="truncate">KGM Hiring Workspace</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/settings">
                <Settings className="size-4" />
                Settings
              </Link>
            </Button>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <AdminSettingsSkeleton />
        ) : (
        <>
        <div className="flex flex-col gap-4">
          <div className="space-y-3">
            <Button asChild variant="ghost" size="sm" className="w-fit px-0">
              <Link href="/admin">
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            </Button>
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-7 rounded-md px-3">
                  <ShieldCheck className="size-3.5 mr-1" />
                     Access control
                </Badge>
                <Badge variant="secondary" className="h-7 rounded-md px-3">
                  {users.length} admins
                </Badge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Admin access
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Manage administrator access, invitations, and account status from
                one organized workspace.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <Card className="h-fit xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-5" />
                Add admin
              </CardTitle>
              <CardDescription>
                We will email a password setup link. If delivery is unavailable,
                you can share the login details manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canManageAdmins ? (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Name</Label>
                    <Input
                      id="admin-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={NO_INPUT_FOCUS_CLASS}
                      placeholder="Full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-designation">Designation or role</Label>
                    <Input
                      id="admin-designation"
                      value={designation}
                      onChange={(event) => setDesignation(event.target.value)}
                      className={NO_INPUT_FOCUS_CLASS}
                      placeholder="Designation"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={NO_INPUT_FOCUS_CLASS}
                      placeholder="name@company.com"
                      required
                    />
                  </div>

                  {message ? (
                    <p
                      className={cn(
                        "flex items-start gap-2 text-sm",
                        "text-muted-foreground",
                      )}
                    >
                      {fallbackPassword ? (
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span>{message}</span>
                    </p>
                  ) : null}

                  {fallbackPassword ? (
                    <div className="border-t pt-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Manual sign-in details</p>
                          <p className="mt-1 text-xs text-muted-foreground">Share this first-time password securely.</p>
                        </div>
                        <div className="flex min-w-0 items-center rounded-md bg-muted/50 p-1 pl-3">
                          <code className="min-w-0 flex-1 break-all text-sm font-semibold">{fallbackPassword}</code>
                          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Copy first-time password" onClick={() => {
                            void navigator.clipboard.writeText(fallbackPassword);
                            toast.success("First-time password copied.");
                          }}>
                            <Copy className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    className="w-full"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    <Mail className="size-4" />
                    {isSubmitting ? "Adding administrator..." : "Add administrator"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  You can view the admin list. Adding admins is available only to
                  authorized admin accounts.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="gap-4 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <CardTitle>Admin directory</CardTitle>
                <CardDescription>
                  Account access, setup state, and contact details in one place.
                </CardDescription>
              </div>
              <div className="flex rounded-md border bg-background p-1" aria-label="Directory view">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  aria-pressed={viewMode === "table"}
                  className="min-w-24"
                  onClick={() => setViewMode("table")}
                >
                  <List className="size-4" />
                  Table
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  aria-pressed={viewMode === "cards"}
                  className="min-w-24"
                  onClick={() => setViewMode("cards")}
                >
                  <Grid2X2 className="size-4" />
                  Cards
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  className={cn("h-10 pl-9", NO_INPUT_FOCUS_CLASS)}
                  placeholder="Search name, role, email, or status"
                  aria-label="Search admin accounts"
                />
              </div>
              {viewMode === "table" ? (
                <div className="overflow-hidden rounded-md border">
                  <div className="max-h-[620px] overflow-auto">
                    <table className="w-full min-w-[920px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b bg-muted/50 text-xs text-muted-foreground backdrop-blur">
                        <tr>
                          <th className="px-4 py-3 font-medium">Administrator</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Access</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          {canModerateAdmins ? (
                            <th className="px-4 py-3 font-medium">Actions</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pagedUsers.map((user) => (
                          <tr key={user.id} className="align-top">
                            <td className="px-4 py-4">
                              <div className="flex gap-3">
                                <AdminAvatar user={user} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-medium">{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.designation}</p>
                                  <p className="mt-1 text-[11px] text-muted-foreground"> {formatDate(user.createdAt)}</p>
                                </div>
                              </div>
                              <div className="mt-3">
                                {renderFallbackPassword(user)}
                              </div>
                            </td>
                            <td className="max-w-64 break-all px-4 py-4 text-sm text-muted-foreground">
                              {user.email}
                            </td>
                            <td className="px-4 py-4">
                              <Badge variant="outline">{getRoleLabel(user)}</Badge>
                            </td>
                            <td className="px-4 py-4"><StatusChip user={user} /></td>
                            {canModerateAdmins ? (
                              <td className="px-4 py-4">
                                {renderAdminActions(user)}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid max-h-[680px] gap-4 overflow-auto pr-1 md:grid-cols-2">
                  {pagedUsers.map((user) => (
                    <div key={user.id} className="rounded-md border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <AdminAvatar user={user} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{user.name}</p>
                          <p className="truncate text-sm text-muted-foreground">{user.designation}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Added {formatDate(user.createdAt)}</p>
                        </div>
                        <StatusChip user={user} />
                      </div>
                      <p className="mt-4 break-all border-t pt-3 text-sm text-muted-foreground">
                        {user.email}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="h-6 rounded-md px-2 text-[11px]">
                          {getRoleLabel(user)}
                        </Badge>
                      </div>
                      <div className="mt-4">{renderFallbackPassword(user)}</div>
                      <div className="mt-4">{renderAdminActions(user)}</div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && sortedUsers.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-10 text-center">
                  <p className="text-sm font-medium">No admin accounts found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try a different name, role, email, or status.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pagedUsers.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-
                  {Math.min(currentPage * PAGE_SIZE, sortedUsers.length)} of{" "}
                  {sortedUsers.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <span className="min-w-20 text-center text-sm text-muted-foreground">
                    {currentPage} / {pageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= pageCount}
                    onClick={() =>
                      setPage((current) => Math.min(pageCount, current + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </section>
    </main>
  );
}
