import { ThemeToggle } from "@/components/theme/theme-toggle";

export function CandidateThemeCorner() {
  return (
    <div className="fixed right-4 top-4 z-30 sm:right-6">
      <ThemeToggle />
    </div>
  );
}
