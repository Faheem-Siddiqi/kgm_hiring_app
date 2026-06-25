"use client";
import { FormEvent, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, KeyRound, LockKeyhole, ShieldCheck, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { message?: string };
      const message = result.message ?? "Sign-in failed.";
      toast.error(message);
      setIsSubmitting(false);
      return;
    }

    toast.success("Welcome to the hiring workspace.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit gap-2">
            <ShieldCheck className="size-3.5" />
            Secure admin sign-in
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Open the hiring workspace
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Sign in with an approved administrator account to manage job
              postings, assessment resources, candidates, and access controls.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              { label: "Jobs", icon: BriefcaseBusiness },
              { label: "Assessments", icon: KeyRound },
              { label: "Admins", icon: UserRoundCog },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-md border bg-muted/20 p-3">
                <Icon className="mb-3 size-4 text-muted-foreground" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/jobs">
              <ArrowLeft className="size-4" />
              Back to jobs
            </Link>
          </Button>
        </div>

        <Card className="shadow-xs">
        <CardHeader className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Hiring Workspace</CardTitle>
            <CardDescription className="mt-2">
              Use your admin credentials to continue.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Work email</Label>
              <Input
                className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <Button className="w-full" disabled={isSubmitting} type="submit">
              <LockKeyhole className="size-4" />
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            <Button
              asChild
              className="h-auto w-full p-0 no-underline hover:no-underline"
              variant="link"
            >
              <Link
                href={`/admin/request-reset-link${
                  email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""
                }`}
                className="flex w-full justify-center no-underline hover:no-underline"
              >
                <span className="relative block w-fit after:absolute after:left-0 after:bottom-0 after:block after:h-[1px] after:w-full after:origin-center after:scale-x-0 after:bg-current after:transition after:duration-300 after:content-[''] hover:after:scale-x-100">
                  Forgot password?
                </span>
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </section>
  );
}
