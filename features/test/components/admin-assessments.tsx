"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import Link from "next/link";
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
import type { AssessmentResourceSummary } from "@/features/test/assessment-resources";
import type {
  AssessmentQuestionType,
  AssessmentSectionSetting,
  PublicAssessment,
} from "@/lib/assessment-types";

type SectionDraft = Record<
  string,
  Record<AssessmentQuestionType, { quantity: number | ""; timeLimitSeconds: number | "" }>
>;

const TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  mcq: "MCQs",
  multi: "Multiple choice",
  text: "Text questions",
};

const ASSESSMENTS_PER_PAGE = 6;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function createSectionDraft(questionBank?: AssessmentResourceSummary): SectionDraft {
  if (!questionBank) return {};

  return Object.fromEntries(
    questionBank.sections.map((section) => [
      section.id,
      {
        mcq: {
          quantity: "",
          timeLimitSeconds: "",
        },
        multi: {
          quantity: "",
          timeLimitSeconds: "",
        },
        text: {
          quantity: "",
          timeLimitSeconds: "",
        },
      },
    ]),
  ) as SectionDraft;
}

function clampNumber(value: string, min: number, max: number) {
  if (value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function buildSectionSettings(
  questionBank: AssessmentResourceSummary,
  selectedSectionIds: string[],
  draft: SectionDraft,
): AssessmentSectionSetting[] {
  return questionBank.sections
    .filter((section) => selectedSectionIds.includes(section.id))
    .map((section) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      types: {
        mcq: {
          quantity: Number(draft[section.id]?.mcq?.quantity ?? 0),
          timeLimitSeconds: Number(draft[section.id]?.mcq?.timeLimitSeconds ?? 0),
        },
        multi: {
          quantity: Number(draft[section.id]?.multi?.quantity ?? 0),
          timeLimitSeconds: Number(draft[section.id]?.multi?.timeLimitSeconds ?? 0),
        },
        text: {
          quantity: Number(draft[section.id]?.text?.quantity ?? 0),
          timeLimitSeconds: Number(draft[section.id]?.text?.timeLimitSeconds ?? 0),
        },
      },
    }));
}

export function AdminAssessments({
  initialAssessments,
  questionBanks,
}: {
  initialAssessments: PublicAssessment[];
  questionBanks: AssessmentResourceSummary[];
}) {
  const sectionPickerRef = useRef<HTMLDivElement | null>(null);
  const sectionConfigRef = useRef<HTMLDivElement | null>(null);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentDescription, setAssessmentDescription] = useState("");
  const [resourceId, setResourceId] = useState(questionBanks[0]?.id ?? "");
  const selectedQuestionBank = questionBanks.find((bank) => bank.id === resourceId);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [sectionConfigOpen, setSectionConfigOpen] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(
    () => questionBanks[0]?.sections.map((section) => section.id) ?? [],
  );
  const [sectionDraft, setSectionDraft] = useState<SectionDraft>(() =>
    createSectionDraft(questionBanks[0]),
  );
  const [query, setQuery] = useState("");
  const [assessmentPage, setAssessmentPage] = useState(1);
  const [loadingBank, setLoadingBank] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        sectionPickerOpen &&
        sectionPickerRef.current &&
        !sectionPickerRef.current.contains(event.target as Node)
      ) {
        setSectionPickerOpen(false);
      }

      if (
        sectionConfigOpen &&
        sectionConfigRef.current &&
        !sectionConfigRef.current.contains(event.target as Node)
      ) {
        setSectionConfigOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [sectionConfigOpen, sectionPickerOpen]);

  const filteredAssessments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return assessments;

    return assessments.filter((assessment) =>
      [
        assessment.code,
        assessment.name,
        assessment.questionBankName,
        assessment.description,
        ...assessment.assignedJobs.map((job) => job.title),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [assessments, query]);

  const totalAssessmentPages = Math.max(
    1,
    Math.ceil(filteredAssessments.length / ASSESSMENTS_PER_PAGE),
  );
  const currentAssessmentPage = Math.min(assessmentPage, totalAssessmentPages);

  const paginatedAssessments = useMemo(
    () =>
      filteredAssessments.slice(
        (currentAssessmentPage - 1) * ASSESSMENTS_PER_PAGE,
        currentAssessmentPage * ASSESSMENTS_PER_PAGE,
      ),
    [currentAssessmentPage, filteredAssessments],
  );

  function updateQuestionBank(nextResourceId: string) {
    const nextBank = questionBanks.find((bank) => bank.id === nextResourceId);
    setResourceId(nextResourceId);

    if (!nextBank) return;

    setLoadingBank(true);
    setSelectedSectionIds(nextBank.sections.map((section) => section.id));
    setSectionDraft(createSectionDraft(nextBank));
    setSectionConfigOpen(false);
    window.setTimeout(() => setLoadingBank(false), 300);
  }

  function updateSectionValue(
    sectionId: string,
    type: AssessmentQuestionType,
    field: "quantity" | "timeLimitSeconds",
    value: number | "",
  ) {
    setSectionDraft((current) => ({
      ...current,
      [sectionId]: {
        ...current[sectionId],
        [type]: {
          ...current[sectionId]?.[type],
          [field]: value,
        },
      },
    }));
  }

  function toggleSection(sectionId: string) {
    setSelectedSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  function isSectionConfigured(section: AssessmentResourceSummary["sections"][number]) {
    return (["mcq", "multi", "text"] as const).every((type) => {
      if (section.counts[type] <= 0) return true;
      const current = sectionDraft[section.id]?.[type];
      return Boolean(
        current &&
          current.quantity !== "" &&
          current.timeLimitSeconds !== "" &&
          current.quantity >= 1 &&
          current.quantity <= section.counts[type] &&
          current.timeLimitSeconds >= 1,
      );
    });
  }

  async function handleCreateAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!assessmentTitle.trim() || !selectedQuestionBank) {
      toast.error("Assessment name and question bank are required.");
      return;
    }

    const sectionSettings = buildSectionSettings(
      selectedQuestionBank,
      selectedSectionIds,
      sectionDraft,
    );

    if (!sectionSettings.length) {
      toast.error("Select at least one section.");
      return;
    }

    const allSelectedSectionsConfigured = selectedQuestionBank.sections
      .filter((section) => selectedSectionIds.includes(section.id))
      .every((section) => isSectionConfigured(section));

    if (!allSelectedSectionsConfigured) {
      toast.error(
        "All selected assessment sections must be configured before creating the assessment.",
      );
      return;
    }

    setSaving(true);
    const response = await fetch("/api/admin/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: assessmentTitle.trim(),
        description:
          assessmentDescription.trim() ||
          `${assessmentTitle.trim()} generated from ${selectedQuestionBank.role}.`,
        questionBankId: selectedQuestionBank.id,
        sectionSettings,
      }),
    });
    const result = (await response.json()) as {
      assessment?: PublicAssessment;
      message?: string;
    };

    setSaving(false);

    if (!response.ok || !result.assessment) {
      toast.error(result.message ?? "Could not create assessment.");
      return;
    }

    setAssessments((current) => [result.assessment!, ...current]);
    setAssessmentTitle("");
    setAssessmentDescription("");
    setSectionConfigOpen(false);
    toast.success(`${result.assessment.code} created.`);
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AdminNavbar />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 w-fit gap-2">
              <ClipboardList className="size-3.5" />
              Assessments
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              Assessment management
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Create question-bank based assessments, configure section quantities, and attach them to jobs from the Jobs page.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/jobs">Assign to jobs</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <Card className="order-2 lg:order-1">
            <CardHeader className="gap-4 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Assessment listing</CardTitle>
                <CardDescription>
                  Search by code, title, question bank, or assigned job.
                </CardDescription>
              </div>
              <Badge variant="outline" className="h-7 rounded-md px-3">
                {filteredAssessments.length} visible
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setAssessmentPage(1);
                  }}
                  className="h-10 pl-9 focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  placeholder="Search assessment code, name, bank, or job"
                />
              </div>
              <div className="grid gap-3">
                {paginatedAssessments.map((assessment) => (
                  <Link
                    key={assessment.id}
                    href={`/admin/assessment/${assessment.id}`}
                    className="rounded-md border bg-card p-4 transition hover:border-foreground/30 hover:bg-muted/30"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{assessment.code}</Badge>
                          <Badge variant="outline">{assessment.questionBankName}</Badge>
                        </div>
                        <p className="mt-2 truncate font-semibold">{assessment.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {assessment.description}
                        </p>
                      </div>
                      <div className="grid w-full grid-cols-3 gap-2 text-center text-[11px] leading-4 text-muted-foreground md:w-64">
                        <div className="min-w-0 overflow-hidden">
                          <BarChart3 className="mx-auto mb-1 size-3.5" />
                          <span className="block truncate">{assessment.sectionCount} sections</span>
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <ClipboardList className="mx-auto mb-1 size-3.5" />
                          <span className="block truncate">{assessment.totalQuestions} questions</span>
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <CheckCircle2 className="mx-auto mb-1 size-3.5" />
                          <span className="block truncate">{assessment.assignedJobs.length} jobs</span>
                        </div>
                      </div>
                    </div>
                    {assessment.assignedJobs.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {assessment.assignedJobs.map((job) => (
                          <Badge key={job.id} variant="outline" className="max-w-full rounded-md">
                            <span className="truncate">{job.title}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Created {formatDate(assessment.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>
              {!filteredAssessments.length ? (
                <div className="rounded-md border border-dashed px-4 py-10 text-center">
                  <p className="text-sm font-medium">No assessments found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create an assessment or adjust the search term.
                  </p>
                </div>
              ) : null}
              {filteredAssessments.length ? (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {currentAssessmentPage} of {totalAssessmentPages} · {filteredAssessments.length} total assessments
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentAssessmentPage <= 1}
                      onClick={() => setAssessmentPage((page) => Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentAssessmentPage >= totalAssessmentPages}
                      onClick={() =>
                        setAssessmentPage((page) => Math.min(totalAssessmentPages, page + 1))
                      }
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card id="create-assessment" className="order-1 lg:order-2">
            <CardHeader>
              <CardTitle>Create assessment</CardTitle>
              <CardDescription>
                Quantity limits come directly from the selected JSON question bank.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateAssessment}>
                <div className="space-y-2">
                  <Label htmlFor="assessment-title">Assessment name</Label>
                  <Input
                    id="assessment-title"
                    value={assessmentTitle}
                    onChange={(event) => setAssessmentTitle(event.target.value)}
                    placeholder="Finance Officer Screening"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assessment-description">Description</Label>
                  <Input
                    id="assessment-description"
                    value={assessmentDescription}
                    onChange={(event) => setAssessmentDescription(event.target.value)}
                    placeholder="Short internal purpose"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-bank">Question bank</Label>
                  <select
                    id="question-bank"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none"
                    value={resourceId}
                    onChange={(event) => updateQuestionBank(event.target.value)}
                  >
                    {questionBanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div ref={sectionPickerRef} className="relative space-y-2">
                  <Label>Sections</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-10 w-full justify-between"
                    onClick={() => setSectionPickerOpen((value) => !value)}
                  >
                    <span className="min-w-0 truncate text-left">
                      {selectedSectionIds.length
                        ? `${selectedSectionIds.length} selected`
                        : "Select sections"}
                    </span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition ${
                        sectionPickerOpen ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                  {sectionPickerOpen && selectedQuestionBank ? (
                    <div className="absolute z-20 max-h-64 w-full overflow-y-auto rounded-md border bg-card p-2 shadow-lg">
                      {selectedQuestionBank.sections.map((section) => (
                        <label
                          key={section.id}
                          className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-muted/40"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={selectedSectionIds.includes(section.id)}
                            onChange={() => toggleSection(section.id)}
                          />
                          <span className="min-w-0 truncate" title={section.title}>
                            {section.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                {selectedQuestionBank ? (
                  <div ref={sectionConfigRef} className="rounded-md border bg-muted/10">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                      onClick={() => setSectionConfigOpen((value) => !value)}
                      aria-expanded={sectionConfigOpen}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background">
                          <Settings2 className="size-4 text-muted-foreground" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            Section configuration
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {selectedSectionIds.length} selected - every selected section must be filled
                          </span>
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-muted-foreground transition ${
                          sectionConfigOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {sectionConfigOpen ? (
                      <div className="space-y-3 border-t p-3">
                        {selectedQuestionBank.sections
                          .filter((section) => selectedSectionIds.includes(section.id))
                          .map((section) => (
                            <div key={section.id} className="rounded-md border bg-background p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium" title={section.title}>
                                    {section.title}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Configure every available question type.
                                  </p>
                                </div>
                                {isSectionConfigured(section) ? (
                                  <Badge variant="secondary" className="shrink-0 gap-1 rounded-md">
                                    <CheckCircle2 className="size-3" />
                                    Ready
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="shrink-0 rounded-md">
                                    Needs setup
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-3 space-y-3">
                                {(["mcq", "multi", "text"] as const).map((type) => {
                                  const availableCount = section.counts[type];
                                  const disabled = availableCount <= 0;

                                  return (
                                    <div
                                      key={type}
                                      className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(92px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end"
                                    >
                                      <p className="truncate text-xs font-medium uppercase text-muted-foreground">
                                        {TYPE_LABELS[type]}
                                      </p>
                                      <div className="space-y-1">
                                        <Input
                                          type="number"
                                          min={disabled ? 0 : 1}
                                          max={availableCount}
                                          disabled={disabled}
                                          placeholder={`Quantity (max ${availableCount})`}
                                          value={sectionDraft[section.id]?.[type]?.quantity ?? ""}
                                          onChange={(event) =>
                                            updateSectionValue(
                                              section.id,
                                              type,
                                              "quantity",
                                              clampNumber(
                                                event.target.value,
                                                disabled ? 0 : 1,
                                                availableCount,
                                              ),
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Input
                                          type="number"
                                          min={1}
                                          max={3600}
                                          disabled={disabled}
                                          placeholder="Time (sec)"
                                          value={
                                            sectionDraft[section.id]?.[type]?.timeLimitSeconds ??
                                            ""
                                          }
                                          onChange={(event) =>
                                            updateSectionValue(
                                              section.id,
                                              type,
                                              "timeLimitSeconds",
                                              clampNumber(event.target.value, 1, 3600),
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        {!selectedSectionIds.length ? (
                          <div className="rounded-md border border-dashed px-4 py-8 text-center">
                            <p className="text-sm font-medium">No sections selected</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Select at least one section before configuring quantities.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Create assessment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
      {loadingBank ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg">
            <div className="space-y-4">
              <div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
              <div className="space-y-2">
                <div className="h-10 animate-pulse rounded-md bg-muted" />
                <div className="h-10 animate-pulse rounded-md bg-muted" />
                <div className="h-10 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
