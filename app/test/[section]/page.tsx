import {
  assessmentSections,
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

  return (
    <SectionRunner
      key={sectionSlug}
      sectionSlug={sectionSlug}
    />
  );
}
