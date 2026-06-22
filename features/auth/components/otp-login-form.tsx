"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      toast.error("Enter a valid 6-digit OTP.");
      return;
    }

    const candidate = authenticateCandidate(otp);

    if (!candidate) {
      toast.error("This access code is invalid or has expired.");
      return;
    }

    setIsSubmitting(true);
    localStorage.setItem("kgm-hiring-authenticated", "true");
    toast.success(`Welcome, ${candidate.name}.`);

    setTimeout(() => {
      router.push("/test");
    }, 500);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <CardTitle className="text-2xl">Candidate Portal</CardTitle>
        <CardDescription>
          Enter the six-digit access code from your assessment invitation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="otp">Assessment access code</Label>
            <Input
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
          <div className="border-t pt-4 text-center">
            <p className="mb-2 text-xs text-muted-foreground">
              Applying for a role?
            </p>
            <Button asChild className="w-full" variant="secondary">
              <Link href="/jobs">
                <BriefcaseBusiness className="size-4" />
                Browse open jobs
              </Link>
            </Button>
          </div>
          <div className="border-t pt-4 text-center">
            <p className="mb-2 text-xs text-muted-foreground">KGM hiring team member?</p>
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
  );
}
