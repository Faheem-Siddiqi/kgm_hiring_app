"use client";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Clock3, KeyRound, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
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

export function RequestResetLinkForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsReady(true), 180);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cooldown > 0) {
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/admin/request-reset-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      toast.error(result.message ?? "Could not request password reset.");
      setIsSubmitting(false);
      return;
    }

    const nextMessage =
      result.message ??
      "If admin email exists, a password reset link has been sent.";
    setCooldown(60);
    toast.success(nextMessage);
    setIsSubmitting(false);
  }

  return (
    <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit gap-2">
            <KeyRound className="size-3.5" />
            Password recovery
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Recover admin access
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Request a secure reset link for an active administrator account.
              The system only responds when the email is eligible.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            {["Active admin email required", "Reset requests are rate limited"].map((item) => (
              <div key={item} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>

        <Card className="shadow-xs">
          <CardHeader className="space-y-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mail className="size-5" />
            </div>
            <CardTitle className="text-2xl">Request reset link</CardTitle>
            <CardDescription>
              Enter the registered email for the admin account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              {!isReady ? (
                <div className="space-y-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                  <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Registered admin email</Label>
                  <Input
                    className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    id="reset-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              )}
              <Button
                className="w-full"
                disabled={isSubmitting || !isReady || cooldown > 0}
                type="submit"
              >
                {cooldown > 0 ? (
                  <>
                    <Clock3 className="size-4" />
                    Resend in {cooldown}s
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    {isSubmitting ? "Sending..." : "Request reset link"}
                  </>
                )}
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/login">
                  <ArrowLeft className="size-4" />
                  Back to login
                </Link>
              </Button>
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mr-2 inline size-3.5" />
                Reset links are sent only to active admin accounts.
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
