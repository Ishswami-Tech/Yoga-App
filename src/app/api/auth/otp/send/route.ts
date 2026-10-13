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
  mode: z.enum(["login", "register"]).default("login"),
  name: z.string().trim().min(2, "Please enter your name").max(80).optional(),
});

const NEUTRAL = { ok: true, message: "If this number is registered, a code was sent." };

// POST /api/auth/otp/send
//
// Sends a 6-digit code on WhatsApp. Works for any ACTIVE user (any role).
// Unknown numbers get the same neutral response (no account enumeration),
// except mode "register", which requires a name and sends a REGISTER code;
// the account is only created after the code verifies.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { mode, name } = parsed.data;

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return fail("Enter a valid WhatsApp number", 422, { code: "INVALID_PHONE" });
    if (mode === "register" && !name) {
      return fail("Please enter your name", 422, { code: "NAME_REQUIRED" });
    }

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
    } else if (mode === "register") {
      purpose = "REGISTER";
    } else {
      return NextResponse.json(NEUTRAL);
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
