"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  Settings,
  ShieldCheck,
  UserCircle,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminNavbarProps = {
  notificationCount?: number;
  notificationsOpen?: boolean;
  notificationPanel?: ReactNode;
  onToggleNotifications?: () => void;
};

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Assessments", href: "/admin/assessments", icon: ClipboardList },
  { label: "Jobs", href: "/admin/jobs", icon: BriefcaseBusiness },
  { label: "Submissions", href: "/admin/submissions", icon: Send },
];

function isActive(pathname: string, href: string) {
  const [path] = href.split("#");

  if (path === "/admin") {
    return pathname === "/admin";
  }

  return pathname === path || pathname.startsWith(`${path}/`);
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
  const showNotifications = Boolean(onToggleNotifications);

  async function handleSignOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.assign("/admin/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card">
            <ShieldCheck className="size-4" />
          </span>
          <span className="truncate">KGM Hiring Workspace</span>
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
          {showNotifications ? (
            <div className="relative">
              <Button
                aria-label="Open admin notifications"
                size="icon"
                variant={notificationsOpen ? "secondary" : "outline"}
                onClick={onToggleNotifications}
              >
                <Bell className="size-4" />
                {notificationCount ? (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {notificationCount}
                  </span>
                ) : null}
              </Button>
              {notificationsOpen ? notificationPanel : null}
            </div>
          ) : null}
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
