"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, MailCheck, Send, ShieldCheck, UserPlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

export function RequestAccessInvitationForm() {
  const [adminEmail, setAdminEmail] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const response = await fetch("/api/admin/request-access-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminEmail, requesterEmail, note }),
    });
    const result = (await response.json()) as {
      mail?: { sent: boolean };
      message?: string;
    };
    const nextMessage =
      result.message ??
      "Your access request was sent to an authorized admin for review.";

    setMessage(nextMessage);

    if (!response.ok) {
      toast.error(nextMessage);
      setIsSubmitting(false);
      return;
    }

    if (result.mail && !result.mail.sent) {
      toast.warning(nextMessage);
    } else {
      toast.success(nextMessage);
    }
    setIsSubmitting(false);
  }

  return (
    <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_460px] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit gap-2">
            <UserPlus className="size-3.5" />
            Admin invitation request
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Request access from a main admin
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Use this page when a setup link has expired or an approved team
              member needs a fresh admin invitation. The request goes to a main
              admin who can review it before access is created.
            </p>
          </div>
          <div className="max-w-2xl space-y-3 border-l pl-4 text-sm leading-6 text-muted-foreground">
            {[
              "Enter the approving main admin first so the request reaches the right reviewer.",
              "Use the requester email for the person who needs admin access.",
              "Add a short note if the old setup link expired or the role needs context.",
            ].map((item) => (
              <p key={item} className="flex gap-2">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </div>

        <Card className="shadow-xs">
          <CardHeader className="space-y-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <CardTitle className="text-2xl">Request admin access</CardTitle>
            <CardDescription>
              Enter the approving admin and the email that needs access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="reviewer-admin-email">Approving admin email</Label>
                <Input
                  className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  id="reviewer-admin-email"
                  type="email"
                  autoComplete="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="main.admin@company.com"
                  required
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  This must be an active main admin who can add sub-admins.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requester-email">Email needing admin access</Label>
                <Input
                  className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  id="requester-email"
                  type="email"
                  autoComplete="email"
                  value={requesterEmail}
                  onChange={(event) => setRequesterEmail(event.target.value)}
                  placeholder="new.admin@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-note">Note for the reviewing admin</Label>
                <Textarea
                  className="min-h-24 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  id="access-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={800}
                  placeholder="Example: My setup link expired. Please review and send a fresh invitation if access is approved."
                />
              </div>
              {message ? (
                <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  <MailCheck className="mr-2 inline size-4" />
                  {message}
                </p>
              ) : null}
              <Button className="w-full" disabled={isSubmitting} type="submit">
                <Send className="size-4" />
                {isSubmitting ? "Sending request..." : "Send access request"}
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/login">
                  <ArrowLeft className="size-4" />
                  Back to login
                </Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
