"use client";
import { FormEvent, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPinned,
  Phone,
  Send,
  ShieldAlert,
} from "lucide-react";
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
import type { PublicJob } from "@/lib/job-types";

type ApplicationResponse = {
  message?: string;
  mail?: { sent?: boolean; reason?: string | null };
};

export function JobApplicationCard({ jobs }: { jobs: PublicJob[] }) {
  const firstAvailableJobId =
    jobs.find((job) => job.status === "open" || job.status === "reopened")?.id ??
    jobs[0]?.id ??
    "";
  const [jobId, setJobId] = useState(firstAvailableJobId);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [availability, setAvailability] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === jobId) ?? jobs[0],
    [jobId, jobs],
  );
  const isSelectedJobClosed =
    selectedJob?.status === "paused" || selectedJob?.status === "closed";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedMessage("");

    if (!jobId) {
      toast.error("Select a job before submitting your application.");
      return;
    }

    if (isSelectedJobClosed) {
      toast.error("This role is not accepting new applications right now.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/candidate/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          candidateName,
          candidateEmail,
          cvUrl,
          availability,
        }),
      });
      const payload = (await response.json()) as ApplicationResponse;

      if (!response.ok) {
        throw new Error(payload.message ?? "Could not submit application.");
      }

      const message =
        payload.message ??
        "Application submitted. The hiring team has been notified.";
      setCandidateName("");
      setCandidateEmail("");
      setCvUrl("");
      setAvailability("");
      setSubmittedMessage(message);

      if (payload.mail?.sent === false) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit application.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
      <CardTitle>Apply for a role</CardTitle>
        <CardDescription>
          Share your details and an accessible drive link to your CV.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submittedMessage ? (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{submittedMessage}</span>
            </div>
          </div>
        ) : null}
        {isSelectedJobClosed ? (
          <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">Applications are currently closed</p>
                <p className="text-muted-foreground">
                  This role is {selectedJob?.status}. Please choose another open
                  role or check back after the hiring team reopens it.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="application-job">Job</Label>
            <select
              id="application-job"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-input focus-visible:ring-0"
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              required
            >
              {jobs.length ? null : <option value="">No open jobs</option>}
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                  {job.status === "paused" || job.status === "closed"
                    ? ` (${job.status})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="candidate-name">Candidate name</Label>
            <Input
              id="candidate-name"
              className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
              value={candidateName}
              onChange={(event) => setCandidateName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="candidate-email">Candidate email</Label>
            <Input
              id="candidate-email"
              type="email"
              className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
              placeholder="candidate@example.com"
              value={candidateEmail}
              onChange={(event) => setCandidateEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="candidate-cv">CV drive link</Label>
            <Input
              id="candidate-cv"
              className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
              placeholder="https://drive.google.com/..."
              value={cvUrl}
              onChange={(event) => setCvUrl(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="candidate-availability">Availability</Label>
            <Textarea
              id="candidate-availability"
              className="min-h-24 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
              placeholder="Notice period, interview timing, and joining availability"
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
              required
            />
          </div>
          <Button
            className="w-full"
            type="submit"
            disabled={isSubmitting || !jobs.length || isSelectedJobClosed}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isSelectedJobClosed
              ? "Applications closed"
              : isSubmitting
                ? "Submitting..."
                : "Submit application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function HiringOfficeCard() {
  return (
    <Card className="overflow-hidden rounded-lg">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-background">
            <Building2 className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="break-words text-base">
              Kohinoor Textile Mills Limited
            </CardTitle>
            <CardDescription>Hiring office contact details</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 p-4 text-sm">
        <div className="rounded-md border bg-background p-3">
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Office
          </p>
          <div className="flex gap-3">
            <MapPinned className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="leading-6 text-foreground/85">
              Kohinoor Textile Mills, Gijar Khan
            </span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex min-w-0 gap-3 rounded-md border bg-background p-3">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="truncate leading-6 text-foreground/85">
              +92 51 3564337
            </span>
          </div>
          <div className="flex min-w-0 gap-3 rounded-md border bg-background p-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words leading-6 text-foreground/85">
              info@kmlg.com
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
