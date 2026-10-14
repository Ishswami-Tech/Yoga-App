import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendOtp } from "@/lib/providers/otp";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizePhone, phoneCandidates } from "@/lib/phone";
import { clientIp, throttle } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ phone: z.string().min(7).max(24) });

const PHONE_TAKEN =
  "This number is already registered with another account. Sign in with that number instead.";

// POST /api/profile/phone/send
//
// A signed-in user without a verified number asks for a WhatsApp code to link one. The number must
// not belong to another account. The code uses the shared OtpCode table and its limits (purpose LINK).
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return fail("Enter a valid WhatsApp number", 422, { code: "INVALID_PHONE" });

    const ip = clientIp(req);
    const perUser = throttle(`phone-link-send:u:${user.id}`, 5, 10 * 60 * 1000);
    const perIp = throttle(`phone-link-send:ip:${ip ?? "unknown"}`, 20, 10 * 60 * 1000);
    if (!perUser.ok || !perIp.ok) {
      return fail("Too many requests. Please try again later.", 429, { code: "RATE_LIMITED" });
    }

    if (user.whatsappNumber) {
      return fail("A WhatsApp number is already linked to this account.", 409, { code: "PHONE_ALREADY_SET" });
    }

    const owner = await db.user.findFirst({
      where: { whatsappNumber: { in: phoneCandidates(phone) }, id: { not: user.id } },
      select: { id: true },
    });
    if (owner) return fail(PHONE_TAKEN, 409, { code: "PHONE_TAKEN" });

    const result = await sendOtp({ phone, purpose: "LINK", ip });
    if (!result.ok) {
      if (result.reason === "NOT_CONFIGURED") {
        return fail("WhatsApp verification is temporarily unavailable", 503, { code: "UNAVAILABLE" });
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
