"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  ListPlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminNavbar } from "@/components/admin/admin-navbar";
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
import {
  JOB_EXPERIENCE_LEVELS,
  JOB_LOCATIONS,
  type JobAssessmentResourceOption,
  type JobListSummary,
  type JobStatus,
  type PublicJob,
} from "@/lib/job-types";

type JobsResponse = {
  jobs: PublicJob[];
  summary: JobListSummary;
};

type JobForm = {
  title: string;
  department: string;
  location: string;
  experience: string;
  assessmentResourceId: string;
  description: string;
  tags: string[];
  responsibilities: string[];
  requirements: string[];
};

const emptyForm: JobForm = {
  title: "",
  department: "",
  location: JOB_LOCATIONS[0],
  experience: JOB_EXPERIENCE_LEVELS[0],
  assessmentResourceId: "",
  description: "",
  tags: [],
  responsibilities: [],
  requirements: [],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getStatusLabel(status: JobStatus) {
  switch (status) {
    case "open":
      return "Opened";
    case "reopened":
      return "Reopened";
    default:
      return status;
  }
}

function getStatusActions(status: JobStatus): Array<{ status: JobStatus; label: string }> {
  if (status === "open" || status === "reopened") {
    return [
      { status: "paused", label: "Pause" },
      { status: "closed", label: "Close" },
    ];
  }

  return [{ status: "reopened", label: "Reopen" }];
}

function ChipInput({
  label,
  value,
  onChange,
  placeholder,
  max,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const isAtMax = Boolean(max && value.length >= max);

  function addItems(raw: string) {
    const items = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!items.length) return;

    const merged = [...value];
    for (const item of items) {
      if (max && merged.length >= max) break;
      if (!merged.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
        merged.push(item);
      }
    }
    onChange(merged);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addItems(draft);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {max ? (
          <span className="text-xs text-muted-foreground">
            {value.length}/{max}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addItems(draft)}
          placeholder={placeholder}
          className={`min-w-0 flex-1 focus-visible:ring-0 focus-visible:shadow-xs ${
            isAtMax
              ? "border-destructive text-destructive placeholder:text-destructive/70 focus-visible:border-destructive"
              : "focus-visible:border-input"
          }`}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Add ${label}`}
          onClick={() => addItems(draft)}
          disabled={!draft.trim() || isAtMax}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {isAtMax ? (
        <p className="text-xs font-medium text-destructive">
          Maximum {max} {label.toLowerCase()} reached.
        </p>
      ) : null}
      {value.length ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {value.map((item) => (
            <Badge key={item} variant="secondary" className="min-w-0 max-w-full gap-1 rounded-md pr-1">
              <span className="min-w-0 whitespace-normal break-words leading-5">{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="shrink-0 rounded-sm p-0.5 hover:bg-background"
                onClick={() => onChange(value.filter((entry) => entry !== item))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminJobs({
  initialJobs,
  initialSummary,
  assessmentResources,
}: {
  initialJobs: PublicJob[];
  initialSummary: JobListSummary;
  assessmentResources: JobAssessmentResourceOption[];
}) {
  const [jobs, setJobs] = useState<PublicJob[]>(initialJobs);
  const [summary, setSummary] = useState<JobListSummary>(initialSummary);
  const [form, setForm] = useState<JobForm>(() => ({
    ...emptyForm,
    assessmentResourceId: assessmentResources[0]?.id ?? "",
  }));
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadJobs() {
    const response = await fetch("/api/admin/jobs");
    const payload = (await response.json()) as JobsResponse & { message?: string };

    if (!response.ok) {
      toast.error(payload.message ?? "Could not load jobs");
      setLoading(false);
      return;
    }

    setJobs(payload.jobs);
    setSummary(payload.summary);
    setLoading(false);
  }

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return jobs;

    return jobs.filter((job) =>
      [
        job.title,
        job.department,
        job.location,
        job.experience,
        job.status,
        job.summary,
        job.assessmentResourceLabel,
        ...job.tags,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [jobs, searchQuery]);

  function updateForm<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      summary: form.description,
    };
    const response = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { job?: PublicJob; message?: string };

    setSaving(false);

    if (!response.ok || !result.job) {
      toast.error(result.message ?? "Could not create job");
      return;
    }

    toast.success("Job created");
    setForm({
      ...emptyForm,
      assessmentResourceId: assessmentResources[0]?.id ?? "",
    });
    await loadJobs();
  }

  async function changeStatus(jobId: string, status: JobStatus) {
    const response = await fetch("/api/admin/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });
    const payload = (await response.json()) as { job?: PublicJob; message?: string };

    if (!response.ok || !payload.job) {
      toast.error(payload.message ?? "Could not update job");
      return;
    }

    setJobs((current) =>
      current.map((job) => (job.id === payload.job?.id ? payload.job : job)),
    );
    toast.success("Job status updated");
    await loadJobs();
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />

      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 w-fit gap-2">
              <BriefcaseBusiness className="size-3.5" />
              Jobs
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Job management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Create candidate-facing jobs, manage status, and keep active listings separate from assessments.
            </p>
          </div>
          <Button asChild>
            <a href="#create-job">
              <ListPlus className="size-4" />
              Create job
            </a>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Total", summary.total],
            ["Open", summary.open],
            ["Paused", summary.paused],
            ["Closed", summary.closed],
            ...(summary.reopened > 0 ? ([["Reopened", summary.reopened]] as const) : []),
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader className="gap-4 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Job listing</CardTitle>
                <CardDescription>Search, pause, close, or reopen jobs.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  void loadJobs();
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 pl-9 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  placeholder="Search title, department, location, status, or tags"
                />
              </div>
              <div className="grid gap-3">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="rounded-md border bg-card p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold">{job.title}</h2>
                          <Badge variant={job.status === "open" || job.status === "reopened" ? "secondary" : "outline"} className="capitalize">
                            {getStatusLabel(job.status)}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{job.summary}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{job.department}</span>
                          <span>{job.location}</span>
                          <span>{job.experience}</span>
                          <span>{job.assessmentResourceLabel} assessment</span>
                          <span>Updated {formatDate(job.updatedAt)}</span>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-2">
                          {job.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="min-w-0 max-w-full text-[11px]">
                              <span className="min-w-0 whitespace-normal break-words leading-4">{tag}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        {getStatusActions(job.status).map((action) => (
                          <Button
                            key={action.status}
                            variant="outline"
                            size="sm"
                            onClick={() => void changeStatus(job.id, action.status)}
                            className="capitalize"
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!loading && !filteredJobs.length ? (
                <div className="rounded-md border border-dashed px-4 py-10 text-center">
                  <p className="text-sm font-medium">No jobs found</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create a job or change the search term.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card id="create-job">
            <CardHeader>
              <CardTitle>Create job</CardTitle>
              <CardDescription>Tags are limited to 10. Lists accept comma or Enter.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateJob}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="job-title">Title</Label>
                    <Input id="job-title" value={form.title} onChange={(event) => updateForm("title", event.target.value)} className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input id="department" value={form.department} onChange={(event) => updateForm("department", event.target.value)} className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <select id="location" className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none" value={form.location} onChange={(event) => updateForm("location", event.target.value)}>
                      {JOB_LOCATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience">Experience</Label>
                    <select id="experience" className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none" value={form.experience} onChange={(event) => updateForm("experience", event.target.value)}>
                      {JOB_EXPERIENCE_LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assessment-resource">Assessment</Label>
                  <select
                    id="assessment-resource"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none"
                    value={form.assessmentResourceId}
                    onChange={(event) => updateForm("assessmentResourceId", event.target.value)}
                  >
                    {assessmentResources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="min-h-24 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs" />
                </div>
                <ChipInput label="Tags" value={form.tags} onChange={(value) => updateForm("tags", value)} placeholder="Add up to 10 tags" max={10} />
                <ChipInput label="Responsibilities" value={form.responsibilities} onChange={(value) => updateForm("responsibilities", value)} placeholder="Add responsibility" />
                <ChipInput label="Requirements" value={form.requirements} onChange={(value) => updateForm("requirements", value)} placeholder="Add requirement" />
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Create job
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
