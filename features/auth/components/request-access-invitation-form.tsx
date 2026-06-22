"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";
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
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <CardTitle className="text-2xl">Request admin access</CardTitle>
        <CardDescription>
          Use this when your first-time setup link expired or you need admin
          access. Enter an approving main-admin email first. We only send the
          request if that admin is allowed to add sub-admins.
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
              className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
              id="access-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={800}
              placeholder="Example: My setup link expired. Please review and send a fresh invitation if access is approved."
            />
          </div>
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          <Button className="w-full" disabled={isSubmitting} type="submit">
            <Send className="size-4" />
            {isSubmitting ? "Sending request..." : "Send access request"}
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
