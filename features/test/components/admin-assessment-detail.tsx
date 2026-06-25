"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Save,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  readAdminDataSnapshot,
  subscribeToAdminData,
  type AssessmentResult,
  type Candidate,
} from "@/features/test/admin-storage";
import { assessmentResourceSummaries } from "@/features/test/assessment-resources";
import type {
  AssessmentQuestionType,
  AssessmentSectionSetting,
  PublicAssessment,
} from "@/lib/assessment-types";

type AdminSnapshot = {
  candidates?: Candidate[];
  results?: AssessmentResult[];
};

type StatItem = {
  label: string;
  value: string | number;
  icon: LucideIcon;
};

const TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  mcq: "Single choice",
  multi: "Multiple select",
  text: "Written response",
};

const ASSIGNED_JOBS_PER_PAGE = 6;

function useAdminData() {
  const snapshot = useSyncExternalStore(subscribeToAdminData, readAdminDataSnapshot, () => "{}");
  const data = JSON.parse(snapshot) as AdminSnapshot;
  return { candidates: data.candidates ?? [], results: data.results ?? [] };
}

function averageScore(results: AssessmentResult[]) {
  return results.length
    ? Math.round(results.reduce((total, result) => total + result.score, 0) / results.length)
    : 0;
}

function clampSettingValue(value: string, min: number, max: number) {
  if (value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function formatSectionTab(index: number) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return `Section-${roman[index] ?? index + 1}`;
}

export function AdminAssessmentDetail({ assessment }: { assessment: PublicAssessment }) {
  const [name, setName] = useState(assessment.name);
  const [description, setDescription] = useState(assessment.description);
  const [sectionSettings, setSectionSettings] = useState<AssessmentSectionSetting[]>(
    assessment.sectionSettings,
  );
  const [activeSectionId, setActiveSectionId] = useState(
    assessment.sectionSettings[0]?.sectionId ?? "",
  );
  const [assignedJobPage, setAssignedJobPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const { candidates, results } = useAdminData();
  const questionBank = assessmentResourceSummaries.find(
    (bank) => bank.id === assessment.questionBankId,
  );
  const assessmentCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.jobId === assessment.id),
    [assessment.id, candidates],
  );
  const assessmentResults = useMemo(
    () => results.filter((result) => result.assessmentId === assessment.id),
    [assessment.id, results],
  );
  const completionRate = assessmentCandidates.length
    ? Math.round((assessmentResults.length / assessmentCandidates.length) * 100)
    : 0;
  const activeSection =
    sectionSettings.find((section) => section.sectionId === activeSectionId) ??
    sectionSettings[0];
  const totalAssignedJobPages = Math.max(
    1,
    Math.ceil(assessment.assignedJobs.length / ASSIGNED_JOBS_PER_PAGE),
  );
  const currentAssignedJobPage = Math.min(assignedJobPage, totalAssignedJobPages);
  const paginatedAssignedJobs = assessment.assignedJobs.slice(
    (currentAssignedJobPage - 1) * ASSIGNED_JOBS_PER_PAGE,
    currentAssignedJobPage * ASSIGNED_JOBS_PER_PAGE,
  );
  const stats: StatItem[] = [
    { label: "Invited", value: assessmentCandidates.length, icon: Users },
    { label: "Completed", value: `${completionRate}%`, icon: CheckCircle2 },
    { label: "Average score", value: `${averageScore(assessmentResults)}%`, icon: BarChart3 },
    { label: "Questions", value: assessment.totalQuestions, icon: Clock },
  ];

  function updateTypeSetting(
    sectionId: string,
    type: AssessmentQuestionType,
    field: "quantity" | "timeLimitSeconds",
    value: number,
  ) {
    setSectionSettings((current) =>
      current.map((section) =>
        section.sectionId === sectionId
          ? {
              ...section,
              types: {
                ...section.types,
                [type]: {
                  ...section.types[type],
                  [field]: value,
                },
              },
            }
          : section,
      ),
    );
  }

  async function saveAssessment(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/assessments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessmentId: assessment.id,
        name,
        description,
        questionBankId: assessment.questionBankId,
        sectionSettings,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setSaving(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not update assessment.");
      return;
    }

    toast.success("Assessment updated.");
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href="/admin/assessments" aria-label="Back to assessments">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{assessment.code}</p>
              <h1 className="truncate text-xl font-semibold tracking-tight">{assessment.name}</h1>
            </div>
          </div>
          <Badge variant="secondary">{assessment.questionBankName}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <Icon className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Assessment profile</CardTitle>
              <CardDescription>Edit the title and internal description.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => void saveAssessment(event)}>
                <div className="space-y-2">
                  <Label htmlFor="assessment-name">Name</Label>
                  <Input id="assessment-name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assessment-description">Description</Label>
                  <Textarea
                    id="assessment-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-28"
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  <Save className="size-4" />
                  Save changes
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section configuration</CardTitle>
              <CardDescription>Update stored question quantities and time limits by section.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid auto-cols-fr grid-flow-col overflow-x-auto border-b">
                {sectionSettings.map((section, index) => (
                  <button
                    key={section.sectionId}
                    type="button"
                    className={`min-w-28 border-b-4 px-3 pb-3 pt-1 text-center text-sm font-medium transition ${
                      section.sectionId === activeSection?.sectionId
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                    }`}
                    onClick={() => setActiveSectionId(section.sectionId)}
                  >
                    {formatSectionTab(index)}
                  </button>
                ))}
              </div>

              {activeSection ? (
                <div className="rounded-md border bg-muted/10 p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{activeSection.sectionTitle}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Limits are checked against {assessment.questionBankName}.
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit gap-1 rounded-md">
                      <Settings2 className="size-3" />
                      Editable
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {(["mcq", "multi", "text"] as const).map((type) => {
                      const sourceSection = questionBank?.sections.find(
                        (section) => section.id === activeSection.sectionId,
                      );
                      const maxQuantity = sourceSection?.counts[type] ?? activeSection.types[type].quantity;

                      return (
                        <div
                          key={type}
                          className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[minmax(150px,0.45fr)_minmax(0,1fr)] sm:items-start"
                        >
                          <p className="text-sm font-medium">{TYPE_LABELS[type]}</p>
                          <div className="grid gap-3 min-[420px]:grid-cols-2">
                            <Input
                              type="number"
                              min={0}
                              max={maxQuantity}
                              placeholder={`Quantity (max ${maxQuantity})`}
                              value={activeSection.types[type].quantity || ""}
                              onChange={(event) =>
                                updateTypeSetting(
                                  activeSection.sectionId,
                                  type,
                                  "quantity",
                                  clampSettingValue(event.target.value, 0, maxQuantity),
                                )
                              }
                            />
                            <Input
                              type="number"
                              min={1}
                              max={3600}
                              placeholder="Time (sec)"
                              value={activeSection.types[type].timeLimitSeconds || ""}
                              onChange={(event) =>
                                updateTypeSetting(
                                  activeSection.sectionId,
                                  type,
                                  "timeLimitSeconds",
                                  clampSettingValue(event.target.value, 1, 3600),
                                )
                              }
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {maxQuantity} available in JSON
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <Button type="button" disabled={saving} onClick={() => void saveAssessment()}>
                <Save className="size-4" />
                Save section settings
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assigned jobs</CardTitle>
            <CardDescription>Jobs using this assessment remain managed from the Jobs workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedAssignedJobs.map((job) => (
              <Link key={job.id} href={`/admin/jobs/${job.slug}`} className="rounded-md border p-4 transition hover:bg-muted/40">
                <Badge variant={job.status === "open" || job.status === "reopened" ? "secondary" : "outline"} className="capitalize">
                  {job.status}
                </Badge>
                <p className="mt-3 font-medium">{job.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{job.department}</p>
              </Link>
            ))}
            {!assessment.assignedJobs.length ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                This assessment is not assigned to any job yet.
              </div>
            ) : null}
            </div>
            {assessment.assignedJobs.length > ASSIGNED_JOBS_PER_PAGE ? (
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {currentAssignedJobPage} of {totalAssignedJobPages} - {assessment.assignedJobs.length} assigned jobs
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentAssignedJobPage <= 1}
                    onClick={() => setAssignedJobPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentAssignedJobPage >= totalAssignedJobPages}
                    onClick={() =>
                      setAssignedJobPage((page) => Math.min(totalAssignedJobPages, page + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
