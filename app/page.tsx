import { OtpLoginForm } from "@/features/auth/components/otp-login-form";

export default function HomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <OtpLoginForm />
    </main>
  );
}
