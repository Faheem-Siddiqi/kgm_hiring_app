"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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

    setIsSubmitting(true);
    localStorage.setItem("kgm-hiring-authenticated", "true");
    toast.success("Authenticated successfully.");

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
        <CardTitle className="text-2xl">Verify OTP</CardTitle>
        <CardDescription>
          Enter the one-time password to continue to your test.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="otp">OTP code</Label>
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
            {isSubmitting ? "Redirecting..." : "Authenticate"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
