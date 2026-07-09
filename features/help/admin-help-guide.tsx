"use client";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  HelpCircle,
  Mail,
  PauseCircle,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GuideStep = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: typeof HelpCircle;
  keywords: string[];
  details: string[];
};

const flowSteps: GuideStep[] = [
  {
    id: "assessment-setup",
    title: "Set up assessment from JSON resources",
    shortTitle: "Assessment setup",
    description:
      "Create the assessment first, select the correct JSON question bank, and configure every selected section before using it in jobs.",
    href: "/admin/assessments",
    actionLabel: "Open assessments",
    icon: SlidersHorizontal,
    keywords: ["assessment", "json", "question bank", "section", "configuration", "time", "questions"],
    details: [
      "Assessment setup is the first required step because jobs should be connected to a real assessment resource, not a loose manual test.",
      "The question bank comes from the available JSON resources (Questions Bank). Admins should select the question bank that matches the job.",
      "Each question bank has differnt sections. Admin can any of them, every selected section must be configured before creating the assessment. Configuration: Section quantity, question counts, and timing must fit the actual question bank  limits.",
      "Question quantities and timers can be updated from the assessment detail/configuration flow, but changes should stay inside the available JSON section data.",
      "Use this page when a new role needs a fresh assessment profile or when an existing assessment needs section/time adjustments.",
    ],
  },
  {
    id: "job-setup",
    title: "Create job and bind assessment",
    shortTitle: "Job setup",
    description:
      "Create the public job, add role content, choose status, and attach the assessment that candidates should attempt.",
    href: "/admin/jobs",
    actionLabel: "Open jobs",
    icon: BriefcaseBusiness,
    keywords: ["job", "status", "open", "paused", "closed", "reopened", "bind", "assessment"],
    details: [
      "A job controls the public role page: title, department, location, requirements, responsibilities, tags, and status.",
      "Select at least one assessment before creating the job so candidate invitations know which assessment flow to launch.",
      "Open and Reopened jobs accept applications and invitations. Paused and Closed jobs preserve history but block new invite actions until reopened.",
      "Use the job configure page for edits. The job detail page should stay analytics-first for reviewing performance and candidate movement.",
    ],
  },
  {
    id: "application-review",
    title: "Review candidate applications",
    shortTitle: "Application review",
    description:
      "Review applications submitted from public jobs, open CV links, and decide whether the applicant should continue.",
    href: "/admin/candidate-applications",
    actionLabel: "Open applications",
    icon: ClipboardCheck,
    keywords: ["application", "cv", "candidate", "pending", "accept", "reject"],
    details: [
      "Applications arrive from both /jobs and /jobs/[jobId] into the same admin inbox.",
      "Pending means no admin has taken a final action yet. The admin should review the candidate name, email, CV link, availability, and job.",
      "Accepting an application marks it accepted for an assessment invite. Rejecting it records the rejection and attempts to email the candidate.",
      "The application detail page records which admin accepted or rejected the application for newer decisions.",
    ],
  },
  {
    id: "candidate-invite",
    title: "Send assessment invite",
    shortTitle: "Invite candidate",
    description:
      "Accepted applicants become candidate invite records and receive the assessment access flow.",
    href: "/admin/candidate-applications",
    actionLabel: "Review invites",
    icon: Mail,
    keywords: ["invite", "otp", "email", "candidate", "expiry", "manual"],
    details: [
      "From the top navigation bar, admins can go to Applications and select a candidate application, or go to Jobs, open a specific job, and invite candidates directly from the job details page.",
      "Set a valid candidate email and invite expiry before sending the invite.",
      "If invite email fails, the application decision still stays saved. Manual OTP fallback appears only for allowed admin roles such as main admin, HOD, or IT.",
      "Existing active invites are reused where possible so the same candidate/job combination does not create unnecessary duplicate invite paths.",
    ],
  },
  {
    id: "submission-review",
    title: "Review assessment submissions",
    shortTitle: "Submission review",
    description:
      "After candidates submit, review score, answers, violations, manual grading needs, and final hiring decision.",
    href: "/admin/submissions",
    actionLabel: "Open submissions",
    icon: FileCheck2,
    keywords: ["submission", "score", "answers", "violations", "final decision", "review"],
    details: [
      "Submitted assessments appear in the submissions area with score, answered count, status, violation history, and written answers.",
      "Text answers may require manual scoring before a final decision is made.",
      "Final accepted/rejected review decisions should be taken after checking score, written answers, and any assessment integrity signals.",
      "Auto-submitted attempts and violations should be reviewed carefully before sending a candidate result.",
    ],
  },
];

const statusRules = [
  {
    status: "Open",
    icon: CheckCircle2,
    description:
      "Visible for active hiring. Candidates can apply and admins can invite candidates.",
    keywords: ["open", "active", "apply", "invite"],
  },
  {
    status: "Paused",
    icon: PauseCircle,
    description:
      "Temporarily stopped. History remains visible, but new applications and candidate invites should wait until reopening.",
    keywords: ["paused", "temporary", "stop", "block"],
  },
  {
    status: "Closed",
    icon: XCircle,
    description:
      "Hiring is finished or not accepting candidates. History remains, but new candidate invitations are blocked.",
    keywords: ["closed", "finished", "not accepting", "block"],
  },
  {
    status: "Reopened",
    icon: RotateCcw,
    description:
      "A paused or closed job is active again. It behaves like Open and records when hiring resumed.",
    keywords: ["reopened", "resume", "active", "open"],
  },
];

const quickRules = [
  {
    title: "Admin access",
    icon: ShieldCheck,
    rules: [
      "Only signed-in admins can open admin pages.",
      "Admin settings manage users, temporary password visibility, paused users, and account management.",
      "Notifications highlight pending applications, submitted assessments, and active invites waiting for submission.",
    ],
  },
  {
    title: "Application decisions",
    icon: ClipboardCheck,
    rules: [
      "Pending means no admin decision yet.",
      "Accepted means approved for an assessment invite.",
      "Rejected means the applicant should not continue for this job.",
      "Email failure should not erase the saved admin decision.",
    ],
  },
  {
    title: "Assessment behavior",
    icon: ClipboardList,
    rules: [
      "Assessments are based on JSON question resources.",
      "Selected sections must be configured before use.",
      "Candidate submissions can include score, manual text review, skipped/unanswered state, and violations.",
    ],
  },
];

function matchesQuery(values: string[], query: string) {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function AdminHelpGuide() {
  const [activeStepId, setActiveStepId] = useState(flowSteps[0].id);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSteps = useMemo(
    () =>
      flowSteps.filter((step) =>
        matchesQuery(
          [
            step.title,
            step.shortTitle,
            step.description,
            step.actionLabel,
            ...step.keywords,
            ...step.details,
          ],
          normalizedQuery,
        ),
      ),
    [normalizedQuery],
  );

  const filteredStatuses = useMemo(
    () =>
      statusRules.filter((status) =>
        matchesQuery([status.status, status.description, ...status.keywords], normalizedQuery),
      ),
    [normalizedQuery],
  );

  const filteredQuickRules = useMemo(
    () =>
      quickRules.filter((section) =>
        matchesQuery([section.title, ...section.rules], normalizedQuery),
      ),
    [normalizedQuery],
  );

  const activeStep =
    filteredSteps.find((step) => step.id === activeStepId) ??
    filteredSteps[0] ??
    flowSteps.find((step) => step.id === activeStepId) ??
    flowSteps[0];

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">
          Dashboard
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">Help guide</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-3 w-fit gap-2 rounded-md">
            <HelpCircle className="size-3.5" />
            Admin help guide
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Hiring portal rules and flow</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Search the guide, click a workflow step, and read the detailed rule panel before taking action.
          </p>
        </div>
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search status, JSON setup, invites, OTP..."
            className="h-11 w-full rounded-md border bg-background px-10 text-sm outline-none transition focus-visible:border-input focus-visible:ring-0"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow steps</CardTitle>
          <CardDescription>
            Click a step to open its detailed rule panel without leaving this guide.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-2">
              {filteredSteps.map((step, index) => {
                const active = step.id === activeStep.id;
                const Icon = step.icon;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepId(step.id)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition",
                      active ? "border-foreground bg-muted/35" : "bg-muted/10 hover:bg-muted/25",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="rounded-md border bg-background p-2 text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{step.shortTitle}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Step {flowSteps.findIndex((item) => item.id === step.id) + 1}
                          </span>
                        </span>
                      </span>
                      <ArrowRight className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              })}
              {!filteredSteps.length ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No workflow steps match this search.
                </div>
              ) : null}
            </div>

            <div className="rounded-md border bg-muted/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Badge variant="outline" className="mb-3 rounded-md">
                    Step {flowSteps.findIndex((step) => step.id === activeStep.id) + 1}
                  </Badge>
                  <h2 className="text-xl font-semibold tracking-tight">{activeStep.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeStep.description}</p>
                </div>
                <Button asChild variant="outline" className="w-fit shrink-0">
                  <Link href={activeStep.href}>
                    {activeStep.actionLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-5 grid gap-3">
                {activeStep.details.map((detail) => (
                  <div key={detail} className="flex gap-3 rounded-md border bg-background p-3 text-sm leading-6">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    <p className="text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Job status meanings</CardTitle>
            <CardDescription>
              These statuses control whether candidates can continue into the hiring flow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredStatuses.map(({ status, description, icon: Icon }) => (
                <div key={status} className="rounded-md border bg-muted/15 p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border bg-background p-2 text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <p className="font-medium">{status}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              ))}
              {!filteredStatuses.length ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
                  No job statuses match this search.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where to go</CardTitle>
            <CardDescription>Common admin destinations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Dashboard analytics", href: "/admin", icon: ClipboardList },
              { label: "Assessments", href: "/admin/assessments", icon: SlidersHorizontal },
              { label: "Jobs and status", href: "/admin/jobs", icon: BriefcaseBusiness },
              { label: "Candidate applications", href: "/admin/candidate-applications", icon: ClipboardCheck },
              { label: "Assessment submissions", href: "/admin/submissions", icon: FileCheck2 },
              { label: "Admin settings", href: "/admin/settings", icon: Settings },
            ].map(({ label, href, icon: Icon }) => (
              <Button key={href} asChild variant="outline" className="w-full justify-start">
                <Link href={href}>
                  <Icon className="size-4" />
                  {label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {filteredQuickRules.map(({ title, icon: Icon, rules }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>Quick rules for this area.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.map((rule) => (
                <div key={rule} className="flex gap-3 rounded-md border bg-muted/15 p-3 text-sm leading-6">
                  {rule.includes("Notifications") ? (
                    <Bell className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Icon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <p className="text-muted-foreground">{rule}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
