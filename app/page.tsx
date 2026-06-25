import { OtpLoginForm } from "@/features/auth/components/otp-login-form";

export default function HomePage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <OtpLoginForm />
    </main>
  );
}
