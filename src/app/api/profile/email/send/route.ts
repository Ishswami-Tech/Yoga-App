import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendEmailOtp } from "@/lib/providers/email-otp";
import { emailConfigured } from "@/lib/providers/email";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizeEmail } from "@/lib/email";
import { clientIp, throttle } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().max(320) });
const HOUR_MS = 60 * 60 * 1000;

// POST /api/profile/email/send
//
// A signed-in user asks for a code to prove an email address before it is stored on the account.
// The address must not belong to another account. Same EmailOtpCode service and limits as sign-in,
// plus a per-user cap so one account cannot spam addresses.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
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
    const perUser = throttle(`profile-email-send:u:${user.id}`, 5, HOUR_MS);
    const perIp = throttle(`profile-email-send:ip:${ip ?? "unknown"}`, 20, 10 * 60 * 1000);
    if (!perUser.ok || !perIp.ok) {
      return fail("Too many requests. Please try again later.", 429, { code: "RATE_LIMITED" });
    }

    if (!emailConfigured()) {
      return fail("Email verification is temporarily unavailable", 503, { code: "UNAVAILABLE" });
    }

    const owner = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: user.id } },
      select: { id: true },
    });
    if (owner) {
      return fail("This email is already registered. Use a different email.", 409, { code: "EMAIL_TAKEN" });
    }

    const result = await sendEmailOtp({ email, ip });
    if (!result.ok) {
      if (result.reason === "NOT_CONFIGURED") {
        return fail("Email verification is temporarily unavailable", 503, { code: "UNAVAILABLE" });
      }
      if (result.reason === "DELIVERY_FAILED") {
        return fail(result.error, 502, { code: "DELIVERY_FAILED" });
      }
      const res = fail(result.error, 429, { code: "RATE_LIMITED" });
      if (result.retryAfterSec) res.headers.set("Retry-After", String(result.retryAfterSec));
      return res;
    }
    return NextResponse.json({ ok: true });
  });
}
