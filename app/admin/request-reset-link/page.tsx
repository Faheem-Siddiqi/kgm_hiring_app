import { RequestResetLinkForm } from "@/features/auth/components/request-reset-link-form";

export default async function RequestResetLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <RequestResetLinkForm initialEmail={email} />
    </main>
  );
}
