"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  KeyRound,
  ShieldCheck,
  UserRoundCog,
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
import { ADMIN_INVITATION_EXPIRY_DAYS } from "@/lib/admin-constants";

type TokenStatus = {
  valid: boolean;
  purpose: "admin-invitation" | "password-reset" | null;
  message?: string;
  email?: string;
  expiresAt?: string;
};

export function SetupPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(Boolean(token));
  const expiresAtLabel = tokenStatus?.expiresAt
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(tokenStatus.expiresAt))
    : "";

  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        setTokenStatus({
          valid: false,
          purpose: null,
          message:
            "Admin setup link is missing. Ask an administrator for a new invitation.",
        });
        setIsCheckingToken(false);
        return;
      }

      setIsCheckingToken(true);

      try {
        const response = await fetch(
          `/api/admin/setup-password?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as TokenStatus;

        if (!isMounted) return;

        setTokenStatus(result);
        if (!response.ok) {
          setFormError(result.message ?? "This setup link is not available.");
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Could not verify admin setup link", error);
        setTokenStatus({
          valid: false,
          purpose: null,
          message:
            "Could not verify this setup link. Ask an administrator for a new invitation.",
        });
      } finally {
        if (isMounted) {
          setIsCheckingToken(false);
        }
      }
    }

    void checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    if (!tokenStatus?.valid) {
      const message = tokenStatus?.message ?? "This setup link is not available.";
      setFormError(message);
      toast.error(message);
      setIsSubmitting(false);
      return;
    }

    const response = await fetch("/api/admin/setup-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = result.message ?? "Could not set your first-time password.";
      setFormError(message);
      toast.error(message);
      setIsSubmitting(false);
      return;
    }

    setIsComplete(true);
    toast.success("Password set. Please sign in to your admin workspace.");
    setIsSubmitting(false);
  }

  return (
    <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit gap-2">
            <UserRoundCog className="size-3.5" />
            First-time admin setup
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Activate your admin access
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Create a private password from your invitation link before opening
              the hiring workspace. Setup links are limited so access stays
              controlled by the admin team.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              { label: "Invite", icon: Clock3 },
              { label: "Password", icon: KeyRound },
              { label: "Admin", icon: ShieldCheck },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-md border bg-muted/20 p-3">
                <Icon className="mb-3 size-4 text-muted-foreground" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/admin/login">
              <ArrowLeft className="size-4" />
              Back to login
            </Link>
          </Button>
        </div>

        <Card className="shadow-xs">
          <CardHeader className="space-y-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <KeyRound className="size-5" />
            </div>
            <CardTitle className="text-2xl">Set your admin password</CardTitle>
            <CardDescription>
              Create your private password to activate KGM Hiring admin access.
              This first-time setup link expires in{" "}
              {ADMIN_INVITATION_EXPIRY_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isCheckingToken ? (
              <div className="space-y-4">
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ) : !tokenStatus?.valid ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">
                  {tokenStatus?.message ?? "This setup link is not available."}
                </p>
                <Button asChild className="w-full">
                  <Link href="/admin/request-access-invitation">
                    Request a fresh invitation
                  </Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/admin/login">
                    <ArrowLeft className="size-4" />
                    Back to login
                  </Link>
                </Button>
              </div>
            ) : isComplete ? (
              <div className="space-y-4">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>Your admin password is ready. Sign in to continue.</span>
                </p>
                <Button asChild className="w-full">
                  <Link href="/admin/login">Sign in</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  First-time setup link expires{" "}
                  {expiresAtLabel
                    ? `on ${expiresAtLabel}`
                    : `in ${ADMIN_INVITATION_EXPIRY_DAYS} days`}.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-password">New password</Label>
                  <Input
                    className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    id="setup-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-confirm-password">
                    Confirm password
                  </Label>
                  <Input
                    className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    id="setup-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                {formError ? (
                  <p className="text-sm text-destructive">{formError}</p>
                ) : null}
                <Button className="w-full" disabled={isSubmitting} type="submit">
                  <KeyRound className="size-4" />
                  {isSubmitting ? "Setting password..." : "Set password"}
                </Button>
                <Button
                  asChild
                  className="h-auto w-full p-0 no-underline hover:no-underline"
                  variant="link"
                >
                  <Link
                    href="/admin/login"
                    className="flex w-full justify-center no-underline hover:no-underline"
                  >
                    <span className="relative block w-fit after:absolute after:left-0 after:bottom-0 after:block after:h-[1px] after:w-full after:origin-center after:scale-x-0 after:bg-current after:transition after:duration-300 after:content-[''] hover:after:scale-x-100">
                      Back to login
                    </span>
                  </Link>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
