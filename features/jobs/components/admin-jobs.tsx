"use client";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  CirclePause,
  Lock,
  ListPlus,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  type JobAssessmentOption,
  type JobListSummary,
  type Pagination,
  type JobStatus,
  type PublicJob,
} from "@/lib/job-types";












type JobsResponse = {
  jobs: PublicJob[];
  summary: JobListSummary;
  pagination: Pagination;
};

type JobForm = {
  title: string;
  department: string;
  location: string;
  experience: string;
  assessmentIds: string[];
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
  assessmentIds: [],
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

function getStatusActions(
  status: JobStatus,
): Array<{ status: JobStatus; label: string }> {
  if (status === "open" || status === "reopened") {
    return [
      { status: "paused", label: "Pause Job" },
      { status: "closed", label: "Close Job" },
    ];
  }

  return [{ status: "reopened", label: "Reopen Job" }];
}

const SUMMARY_ICONS: Record<string, LucideIcon> = {
  Total: BriefcaseBusiness,
  Open: CheckCircle2,
  Paused: CirclePause,
  Closed: Lock,
  Reopened: RotateCcw,
};

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

      if (
        !merged.some(
          (existing) => existing.toLowerCase() === item.toLowerCase(),
        )
      ) {
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
            <Badge
              key={item}
              variant="secondary"
              className="min-w-0 max-w-full gap-1 rounded-md pr-1"
            >
              <span className="min-w-0 whitespace-normal break-words leading-5">
                {item}
              </span>

              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="shrink-0 rounded-sm p-0.5 hover:bg-background"
                onClick={() =>
                  onChange(value.filter((entry) => entry !== item))
                }
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
  initialPagination,
  assessments,
}: {
  initialJobs: PublicJob[];
  initialSummary: JobListSummary;
  initialPagination: Pagination;
  assessments: JobAssessmentOption[];
}) {
  const router = useRouter();

  const assessmentPickerRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const [jobs, setJobs] = useState<PublicJob[]>(initialJobs);
  const [summary, setSummary] = useState<JobListSummary>(initialSummary);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [form, setForm] = useState<JobForm>(() => ({ ...emptyForm }));

  const [searchQuery, setSearchQuery] = useState("");
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [assessmentPickerOpen, setAssessmentPickerOpen] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        assessmentPickerOpen &&
        assessmentPickerRef.current &&
        !assessmentPickerRef.current.contains(target)
      ) {
        setAssessmentPickerOpen(false);
      }

      if (
        activeActionMenuId &&
        actionMenuRef.current &&
        !actionMenuRef.current.contains(target)
      ) {
        setActiveActionMenuId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [assessmentPickerOpen, activeActionMenuId]);

  async function loadJobs(page = pagination.page) {
    const response = await fetch(
      `/api/admin/jobs?page=${page}&pageSize=${pagination.pageSize}`,
    );

    const payload = (await response.json()) as JobsResponse & {
      message?: string;
    };

    if (!response.ok) {
      toast.error(payload.message ?? "Could not load jobs");
      setLoading(false);
      return;
    }

    setJobs(payload.jobs);
    setSummary(payload.summary);
    setPagination(payload.pagination);
    setLoading(false);
  }

  const filteredAssessments = useMemo(() => {
    const query = assessmentSearch.trim().toLowerCase();

    if (!query) return assessments;

    return assessments.filter((assessment) =>
      [
        assessment.code,
        assessment.name,
        assessment.questionBankName,
        ...assessment.tags,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [assessmentSearch, assessments]);

  const selectedAssessments = useMemo(
    () =>
      assessments.filter((assessment) =>
        form.assessmentIds.includes(assessment.id),
      ),
    [assessments, form.assessmentIds],
  );

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
        ...job.assessments.flatMap((assessment) => assessment.tags),
        ...job.tags,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [jobs, searchQuery]);

  function updateForm<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.assessmentIds.length !== 1) {
      toast.error("Select one assessment before creating the job.");
      return;
    }

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

    const result = (await response.json()) as {
      job?: PublicJob;
      message?: string;
    };

    setSaving(false);

    if (!response.ok || !result.job) {
      toast.error(result.message ?? "Could not create job");
      return;
    }

    setJobs((current) => {
      const nextJobs = [
        result.job!,
        ...current.filter((job) => job.id !== result.job!.id),
      ];

      return nextJobs.slice(0, pagination.pageSize);
    });

    setSummary((current) => ({
      ...current,
      total: current.total + 1,
      open: current.open + (result.job!.status === "open" ? 1 : 0),
      paused: current.paused + (result.job!.status === "paused" ? 1 : 0),
      closed: current.closed + (result.job!.status === "closed" ? 1 : 0),
    }));

    setPagination((current) => {
      const total = current.total + 1;

      return {
        ...current,
        page: 1,
        total,
        totalPages: Math.max(1, Math.ceil(total / current.pageSize)),
      };
    });

    setSearchQuery("");
    toast.success("Job created");
    setForm({ ...emptyForm });
    router.refresh();
  }

  async function changeStatus(jobId: string, status: JobStatus) {
    setActiveActionMenuId(null);

    const response = await fetch("/api/admin/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });

    const payload = (await response.json()) as {
      job?: PublicJob;
      message?: string;
    };

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

  function selectAssessment(assessmentId: string) {
    updateForm("assessmentIds", [assessmentId]);
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

            <h1 className="text-3xl font-semibold tracking-tight">
              Job management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Create candidate-facing jobs, manage status, and keep active
              listings separate from assessments.
            </p>
          </div>

          <Button asChild>
            <Link href="/admin/assessments">
            
              Create Assessment
            </Link>
          </Button>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Total", summary.total],
            ["Open", summary.open],
            ["Paused", summary.paused],
            ["Closed", summary.closed],
            ...(summary.reopened > 0
              ? ([["Reopened", summary.reopened]] as const)
              : []),
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                {(() => {
                  const Icon = SUMMARY_ICONS[label];

                  return Icon ? (
                    <Icon className="mb-3 size-5 text-muted-foreground" />
                  ) : null;
                })()}

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
                <CardDescription>
                  Search and manage job status from the settings menu.
                </CardDescription>
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
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
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

              <div className="relative isolate grid gap-3 overflow-visible">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className={`relative rounded-md border bg-card p-4 ${
                      activeActionMenuId === job.id ? "z-[2147483647]" : "z-0"
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/jobs/${job.slug}`}
                            className="block w-fit max-w-full rounded-sm"
                          >
                            <h2 className="min-w-0 break-words font-semibold leading-6 hover:underline">
                              {job.title}
                            </h2>
                          </Link>

                          {job.assessments.length ? (
                            <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                              {job.assessments.map((assessment) => (
                                <Badge
                                  key={assessment.id}
                                  variant="secondary"
                                  className="max-w-full rounded-md"
                                >
                                  <span className="min-w-0 whitespace-normal break-words leading-4">
                                    {assessment.code}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          ) : (



<Badge variant="secondary" className="max-w-full rounded-md" > <span className="min-w-0 whitespace-normal break-words leading-4"> No Assessment Linked</span> </Badge>



                            
                          )}
                        </div>

                        <div className="ml-auto flex shrink-0 items-center gap-2">
                          <Badge
                            variant={
                              job.status === "open" ||
                              job.status === "reopened"
                                ? "secondary"
                                : "outline"
                            }
                            className="capitalize"
                          >
                            {getStatusLabel(job.status)}
                          </Badge>

                          <div
                            ref={
                              activeActionMenuId === job.id
                                ? actionMenuRef
                                : null
                            }
                            className="relative z-[2147483647]"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Job settings"
                              aria-expanded={activeActionMenuId === job.id}
                              onClick={() =>
                                setActiveActionMenuId((current) =>
                                  current === job.id ? null : job.id,
                                )
                              }
                              className="size-8"
                            >
                              <MoreVertical className="size-4" />
                            </Button>

                            {activeActionMenuId === job.id ? (
                              <div className="absolute right-0 top-9 z-[2147483647] w-40 overflow-hidden rounded-md border bg-background p-1 ring-1 ring-border">
                                {getStatusActions(job.status).map((action) => (
                                  <button
                                    key={action.status}
                                    type="button"
                                    className="flex w-full items-center rounded-sm bg-background px-3 py-2 text-left text-sm hover:bg-muted"
                                    onClick={() =>
                                      void changeStatus(job.id, action.status)
                                    }
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/admin/jobs/${job.slug}`}
                        className="relative z-0 block min-w-0 rounded-sm"
                      >
                        <p className="relative z-0 text-sm leading-6 text-muted-foreground">
                          {job.summary}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{job.department}</span>
                          <span>{job.location}</span>
                          <span>{job.experience}</span>
                          <span>
                            {job.assessments.length
                              ? `${job.assessments.length} assessments`
                              : "No assessment"}
                          </span>
                          <span>Updated {formatDate(job.updatedAt)}</span>
                        </div>

                        {job.tags.length ? (
                          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                            {job.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="min-w-0 max-w-full text-[11px]"
                              >
                                <span className="min-w-0 whitespace-normal break-words leading-4">
                                  {tag}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {!loading && !filteredJobs.length ? (
                <div className="rounded-md border border-dashed px-4 py-10 text-center">
                  <p className="text-sm font-medium">No jobs found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a job or change the search term.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ·{" "}
                  {pagination.total} total jobs
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || pagination.page <= 1}
                    onClick={() => {
                      setLoading(true);
                      void loadJobs(pagination.page - 1);
                    }}
                  >
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || pagination.page >= pagination.totalPages}
                    onClick={() => {
                      setLoading(true);
                      void loadJobs(pagination.page + 1);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="create-job">
            <CardHeader>
              <CardTitle>Create job</CardTitle>
              <CardDescription>
                Tags are limited to 10. Lists accept comma or Enter.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateJob}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="job-title">Title</Label>
                    <Input
                      id="job-title"
                      value={form.title}
                      onChange={(event) =>
                        updateForm("title", event.target.value)
                      }
                      className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={form.department}
                      onChange={(event) =>
                        updateForm("department", event.target.value)
                      }
                      className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <select
                      id="location"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none"
                      value={form.location}
                      onChange={(event) =>
                        updateForm("location", event.target.value)
                      }
                    >
                      {JOB_LOCATIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experience">Experience</Label>
                    <select
                      id="experience"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none"
                      value={form.experience}
                      onChange={(event) =>
                        updateForm("experience", event.target.value)
                      }
                    >
                      {JOB_EXPERIENCE_LEVELS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div ref={assessmentPickerRef} className="relative space-y-2">
                  <Label>Assessments</Label>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-10 w-full justify-between"
                    onClick={() => setAssessmentPickerOpen((value) => !value)}
                  >
                    <span className="min-w-0 truncate text-left">
                      {selectedAssessments.length
                        ? selectedAssessments[0]?.name
                        : "Select one assessment"}
                    </span>
                    <Search className="size-4 shrink-0 text-muted-foreground" />
                  </Button>

                  {selectedAssessments.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedAssessments.map((assessment) => (
                        <Badge
                          key={assessment.id}
                          variant="secondary"
                          className="max-w-full rounded-md"
                        >
                          <span className="truncate">
                            {assessment.code} · {assessment.name}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {assessmentPickerOpen ? (
                    <div className="absolute z-20 w-full rounded-md border bg-card p-3 shadow-lg">
                      <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          value={assessmentSearch}
                          onChange={(event) =>
                            setAssessmentSearch(event.target.value)
                          }
                          className="h-9 pl-9 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                          placeholder="Search code, title, bank, or tag"
                        />
                      </div>

                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {filteredAssessments.map((assessment) => (
                          <label
                            key={assessment.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm hover:bg-muted/40"
                          >
                            <input
                              type="radio"
                              name="job-assessment"
                              className="mt-1 size-4 accent-primary"
                              checked={form.assessmentIds.includes(
                                assessment.id,
                              )}
                              onChange={() => selectAssessment(assessment.id)}
                            />

                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {assessment.code} · {assessment.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {assessment.questionBankName}
                              </span>
                            </span>
                          </label>
                        ))}

                        {!filteredAssessments.length ? (
                          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            No assessments found.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", event.target.value)
                    }
                    className="min-h-24 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  />
                </div>

                <ChipInput
                  label="Tags"
                  value={form.tags}
                  onChange={(value) => updateForm("tags", value)}
                  placeholder="Add up to 10 tags"
                  max={10}
                />

                <ChipInput
                  label="Responsibilities"
                  value={form.responsibilities}
                  onChange={(value) => updateForm("responsibilities", value)}
                  placeholder="Add responsibility"
                />

                <ChipInput
                  label="Requirements"
                  value={form.requirements}
                  onChange={(value) => updateForm("requirements", value)}
                  placeholder="Add requirement"
                />

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
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
