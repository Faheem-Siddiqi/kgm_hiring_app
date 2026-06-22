"use client";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Clock3, Mail } from "lucide-react";
import Link from "next/link";
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
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Request reset link</CardTitle>
        <CardDescription>
         Please enter the registered email. Reset links are sent
          only for active admins.
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
            <div className="space-y-3">
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
            </div>
          )}
          {/* {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null} */}
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
          <Button asChild className="w-full" variant="ghost">
            <Link href="/admin/login">
              <ArrowLeft className="size-4" />
              Back to login
            </Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
