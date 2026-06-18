import { notFound } from "next/navigation";
import {
  assessmentSections,
  getNextSectionSlug,
  getPreviousSectionSlug,
  getSectionBySlug,
} from "@/features/test/assessment-data";
import { SectionRunner } from "@/features/test/components/section-runner";

export function generateStaticParams() {
  return assessmentSections.map((section) => ({
    section: section.slug,
  }));
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: sectionSlug } = await params;
  const section = getSectionBySlug(sectionSlug);

  if (!section) {
    notFound();
  }

  return (
    <SectionRunner
      key={section.slug}
      section={section}
      previousSectionSlug={getPreviousSectionSlug(section.slug)}
      nextSectionSlug={getNextSectionSlug(section.slug)}
    />
  );
}
