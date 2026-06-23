import { AdminLoginForm } from "@/features/auth/components/admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <AdminLoginForm />
    </main>
  );
}
