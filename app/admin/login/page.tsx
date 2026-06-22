import { AdminLoginForm } from "@/features/auth/components/admin-login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <AdminLoginForm sessionExpired={expired === "1"} />
    </main>
  );
}
