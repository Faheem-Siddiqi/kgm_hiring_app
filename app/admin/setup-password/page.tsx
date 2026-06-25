import { SetupPasswordForm } from "@/features/auth/components/setup-password-form";

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <SetupPasswordForm token={token} />
    </main>
  );
}
