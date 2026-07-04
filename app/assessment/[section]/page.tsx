import { getAssessmentResourceSectionSlugs } from "@/features/test/assessment-resources";
import { SectionRunner } from "@/features/test/components/section-runner";

export function generateStaticParams() {
  return getAssessmentResourceSectionSlugs().map((section) => ({
    section,
  }));
}

export default async function AssessmentSectionPage({
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
