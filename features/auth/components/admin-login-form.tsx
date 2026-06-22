"use client";
import { FormEvent, useState } from "react";
import { BriefcaseBusiness, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionExpiryDialog } from "@/features/auth/components/session-expiry-dialog";

export function AdminLoginForm({ sessionExpired = false }: { sessionExpired?: boolean }) {
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
    <>
      <SessionExpiryDialog open={sessionExpired} />
      <Card className="w-full max-w-md shadow-xs">
        <CardHeader className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Hiring Workspace</CardTitle>
            <CardDescription className="mt-2">
              Sign in to create assessments, invite candidates, and review results.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Work email</Label>
              <Input className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs" id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs" id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {/* {formError ? (
              <p className="text-sm text-destructive">
                {formError}
              </p>
            ) : null} */}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              <LockKeyhole className="size-4" />
              {isSubmitting ? "Signing In..." : "Sign In"}
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
    </>
  );
}
