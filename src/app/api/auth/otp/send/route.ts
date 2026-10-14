import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOtp } from "@/lib/providers/otp";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizePhone, phoneCandidates } from "@/lib/phone";
import { clientIp, throttle } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(7).max(24),
});

const NEUTRAL = { ok: true, message: "If this number is registered, a code was sent." };

// POST /api/auth/otp/send
//
// Single sign-in / sign-up entry: sends a 6-digit code on WhatsApp. An ACTIVE user gets a LOGIN
// code, an unknown number gets a REGISTER code (the STUDENT account is only created after the code
// verifies), a non-ACTIVE user gets the neutral response without a send. The response is identical
// in every non-error case, so it does not reveal whether a number is registered.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return fail("Enter a valid WhatsApp number", 422, { code: "INVALID_PHONE" });

    const ip = clientIp(req);
    // Second layer only; the OtpCode table is the authority.
    const t = throttle(`otp-send:${ip ?? "unknown"}`, 20, 10 * 60 * 1000);
    if (!t.ok) {
      return fail("Too many requests. Please try again later.", 429, { code: "RATE_LIMITED" });
    }

    const user = await db.user.findFirst({
      where: { whatsappNumber: { in: phoneCandidates(phone) } },
      select: { status: true },
      orderBy: { createdAt: "asc" },
    });

    let purpose: "LOGIN" | "REGISTER";
    if (user) {
      if (user.status !== "ACTIVE") return NextResponse.json(NEUTRAL);
      purpose = "LOGIN";
    } else {
      purpose = "REGISTER";
    }

    const result = await sendOtp({ phone, purpose, ip });
    if (!result.ok) {
      if (result.reason === "NOT_CONFIGURED") {
        return fail("Sign-in is temporarily unavailable", 503, { code: "UNAVAILABLE" });
      }
      if (result.reason === "DELIVERY_FAILED") {
        return fail(result.error, 502, { code: "DELIVERY_FAILED" });
      }
      const res = fail(result.error, 429, { code: "RATE_LIMITED" });
      if (result.retryAfterSec) res.headers.set("Retry-After", String(result.retryAfterSec));
      return res;
    }
    return NextResponse.json(NEUTRAL);
  });
}
