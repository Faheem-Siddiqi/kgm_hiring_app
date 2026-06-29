import { NextResponse } from "next/server";
import { authenticateCandidateOtp } from "@/lib/hiring-records";
import { withErrorHandler } from "@/lib/server-error";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (request: Request) => {
  const body = (await request.json()) as { otpCode?: string };
  const otpCode = body.otpCode?.trim() ?? "";

  if (!/^\d{6}$/.test(otpCode)) {
    return NextResponse.json(
      { message: "Enter a valid 6-digit OTP." },
      { status: 400 },
    );
  }

  const session = await authenticateCandidateOtp(otpCode);

  if (!session) {
    return NextResponse.json(
      { message: "This access code is invalid, expired, or already submitted." },
      { status: 401 },
    );
  }

  return NextResponse.json(session);
});
