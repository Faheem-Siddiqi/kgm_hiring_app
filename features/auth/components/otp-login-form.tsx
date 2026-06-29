"use client";
import { FormEvent, useState } from "react";
import { BriefcaseBusiness, ClipboardCheck, KeyRound, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticateCandidate } from "@/features/test/admin-storage";

export function OtpLoginForm() {
  const router = useRouter();
  const [otp, setOtp] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const inviteOtp = new URLSearchParams(window.location.search)
      .get("otp")
      ?.replace(/\D/g, "")
      .slice(0, 6);

    return inviteOtp?.length === 6 ? inviteOtp : "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      toast.error("Enter a valid 6-digit OTP.");
      return;
    }

    setIsSubmitting(true);
    try {
      const candidate = await authenticateCandidate(otp);
      localStorage.setItem("kgm-hiring-authenticated", "true");
      toast.success(`Welcome, ${candidate.name}.`);

      setTimeout(() => {
        router.push("/test");
      }, 500);
    } catch (error) {
      setIsSubmitting(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "This access code is invalid, expired, or already submitted.",
      );
    }
  }

  return (
    <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit gap-2">
            <UserCheck className="size-3.5" />
            Candidate assessment portal
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Continue your KGM assessment
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Use the six-digit invitation code shared by the hiring team to
              open your assigned role assessment.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              { label: "Access code", icon: KeyRound },
              { label: "Role test", icon: ClipboardCheck },
              { label: "Secure flow", icon: ShieldCheck },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-md border bg-muted/20 p-3">
                <Icon className="mb-3 size-4 text-muted-foreground" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="shadow-xs">
          <CardHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <CardTitle className="text-2xl">Candidate Portal</CardTitle>
            <CardDescription>
              Enter the access code from your assessment invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="otp">Assessment access code</Label>
                <Input
                  className="focus-visible:border-input focus-visible:ring-0 focus-visible:shadow-xs"
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Opening assessment..." : "Continue to assessment"}
              </Button>
              <div className="grid gap-2 border-t pt-4">
                <Button asChild className="w-full" variant="secondary">
                  <Link href="/jobs">
                    <BriefcaseBusiness className="size-4" />
                    Browse open jobs
                  </Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/admin/login">
                    <BriefcaseBusiness className="size-4" />
                    Open hiring workspace
                  </Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
