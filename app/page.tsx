import { CandidateThemeCorner } from "@/components/theme/candidate-theme-corner";
import { OtpLoginForm } from "@/features/auth/components/otp-login-form";

export default function HomePage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <CandidateThemeCorner />
      <OtpLoginForm />
    </main>
  );
}
