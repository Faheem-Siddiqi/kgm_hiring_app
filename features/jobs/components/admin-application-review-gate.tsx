"use client";

import { FormEvent, useState } from "react";
import { BriefcaseBusiness, LockKeyhole, ShieldCheck } from "lucide-react";
import Image from "next/image";
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
import { AdminCandidateApplicationDetail } from "@/features/jobs/components/admin-candidate-application-detail";
import darkLogo from "@/src/assets/DarkLogo.png";

export function AdminApplicationReviewGate({
  applicationId,
  initiallyAuthenticated,
}: {
  applicationId: string;
  initiallyAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initiallyAuthenticated);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "The email or password is incorrect.");
      }

      toast.success("Admin verified. Opening candidate review.");
      setAuthenticated(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not verify admin credentials.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authenticated) {
    return <AdminCandidateApplicationDetail applicationId={applicationId} />;
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="space-y-5">
            <Badge variant="secondary" className="w-fit gap-2">
              <ShieldCheck className="size-3.5" />
              Protected application review
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
                Verify admin access to review this candidate
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                This email link opens a temporary review gate. Only active platform
                admins can continue to the candidate application and assessment invite
                card.
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit">
              <Link href="/jobs">
                <BriefcaseBusiness className="size-4" />
                Browse open jobs
              </Link>
            </Button>
          </div>

          <Card className="shadow-xs">
            <CardHeader className="space-y-4">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image
                  src={darkLogo}
                  alt="KGM hiring logo"
                  className="size-7 object-contain"
                  priority
                />
              </div>
              <div>
                <CardTitle className="text-2xl">Admin credentials</CardTitle>
                <CardDescription className="mt-2">
                  Use an active admin account to open the review card.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="review-admin-email">Work email</Label>
                  <Input
                    id="review-admin-email"
                    type="email"
                    autoComplete="username"
                    className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-admin-password">Password</Label>
                  <Input
                    id="review-admin-password"
                    type="password"
                    autoComplete="current-password"
                    className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <Button className="w-full" disabled={isSubmitting} type="submit">
                  <LockKeyhole className="size-4" />
                  {isSubmitting ? "Verifying..." : "Open review"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
