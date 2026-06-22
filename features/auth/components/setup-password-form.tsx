"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
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
          message: "Could not verify this setup link. Ask an administrator for a new invitation.",
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
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <KeyRound className="size-5" />
        </div>
        <CardTitle className="text-2xl">Set your admin password</CardTitle>
        <CardDescription>
          Create your private password to activate KGM Hiring admin access. This
          first-time setup link expires in {ADMIN_INVITATION_EXPIRY_DAYS} days.
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
            <Button asChild className="w-full">
              <Link href="/admin/login">Back to login</Link>
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
              <Label htmlFor="setup-confirm-password">Confirm password</Label>
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
            <Button asChild className="w-full" variant="ghost">
              <Link href="/admin/login">
                <ArrowLeft className="size-4" />
                Back to login
              </Link>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
