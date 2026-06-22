"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
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

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    const response = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = result.message ?? "Could not reset password.";
      setFormError(message);
      toast.error(message);
      setIsSubmitting(false);
      return;
    }

    setIsComplete(true);
    toast.success("Password updated. Please sign in again.");
    setIsSubmitting(false);
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <CardDescription>
          Set a new admin password. Reset links expire after 20 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              Reset token is missing. Request a new reset link.
            </p>
            <Button asChild className="w-full">
              <Link href="/admin/forgot-password">Request reset link</Link>
            </Button>
          </div>
        ) : isComplete ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your password has been updated.
            </p>
            <Button asChild className="w-full">
              <Link href="/admin/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                id="confirm-password"
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
              <LockKeyhole className="size-4" />
              {isSubmitting ? "Updating..." : "Update password"}
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
