import { notFound } from "next/navigation";
import {
  getNextSectionSlug,
  getPreviousSectionSlug,
  getSectionBySlug,
} from "@/features/test/assessment-data";
import { SectionRunner } from "@/features/test/components/section-runner";

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
      section={section}
      previousSectionSlug={getPreviousSectionSlug(section.slug)}
      nextSectionSlug={getNextSectionSlug(section.slug)}
    />
  );
}
