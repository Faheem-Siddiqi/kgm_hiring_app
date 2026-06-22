import { SetupPasswordForm } from "@/features/auth/components/setup-password-form";

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <SetupPasswordForm token={token} />
    </main>
  );
}
