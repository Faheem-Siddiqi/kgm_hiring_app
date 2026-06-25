"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createJobAssessment } from "@/features/test/admin-storage";
import type { ComponentProps } from "react";

export function JobAssessmentButton({
  jobTitle,
  resourceId,
  className = "w-full",
  label = "Apply and attempt assessment",
  size = "lg",
  disabled = false,
}: {
  jobTitle: string;
  resourceId: string;
  className?: string;
  label?: string;
  size?: ComponentProps<typeof Button>["size"];
  disabled?: boolean;
}) {
  function startAssessment() {
    if (!resourceId) return;

    createJobAssessment({
      title: `${jobTitle} Assessment`,
      resourceId,
      sectionCount: 3,
      timePerSectionMinutes: 15,
      questionsPerSection: 20,
    });
    window.location.href = "/test";
  }

  return (
    <Button className={className} size={size} onClick={startAssessment} disabled={disabled}>
      {label}
      <ArrowRight className="size-4" />
    </Button>
  );
}
