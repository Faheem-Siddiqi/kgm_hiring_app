import { RequestAccessInvitationForm } from "@/features/auth/components/request-access-invitation-form";

export default function RequestAccessInvitationPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <RequestAccessInvitationForm />
    </main>
  );
}
