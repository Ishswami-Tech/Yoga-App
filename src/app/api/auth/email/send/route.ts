import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmailOtp } from "@/lib/providers/email-otp";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizeEmail } from "@/lib/email";
import { clientIp, throttle } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().max(320) });

const NEUTRAL = { ok: true, message: "If this address can receive email, a code was sent." };

// POST /api/auth/email/send
//
// Sends a 6-digit sign-in code by email. The answer is identical for every valid address (known,
// unknown or disabled), so it never reveals whether an account exists. A disabled account gets the
// neutral answer without a send. Limits live in the EmailOtpCode table; the throttle is a second layer.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const email = normalizeEmail(parsed.data.email);
    if (!email) {
      return fail("Validation failed", 422, {
        code: "VALIDATION",
        details: [{ path: ["email"], message: "Enter a valid email address" }],
      });
    }

    const ip = clientIp(req);
    const t = throttle(`email-send:${ip ?? "unknown"}`, 20, 10 * 60 * 1000);
    if (!t.ok) return fail("Too many requests. Please try again later.", 429, { code: "RATE_LIMITED" });

    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { status: true },
    });
    if (user && user.status !== "ACTIVE") return NextResponse.json(NEUTRAL);

    const result = await sendEmailOtp({ email, ip });
    if (!result.ok) {
      if (result.reason === "NOT_CONFIGURED") {
        return fail("Email sign-in is temporarily unavailable", 503, { code: "UNAVAILABLE" });
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
