import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <ForgotPasswordForm initialEmail={email} />
    </main>
  );
}
