import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, toAuthUser } from "@/lib/auth";
import { verifyEmailOtp } from "@/lib/providers/email-otp";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizeEmail } from "@/lib/email";
import { clientIp, throttle } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { audit } from "@/lib/services/audit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().max(320),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const EMAIL_TAKEN = "This email is already registered. Use a different email.";

// POST /api/profile/email/verify
//
// Proves the emailed code and only then stores the address on the signed-in account (verified).
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
    const perUser = throttle(`profile-email-verify:u:${user.id}`, 15, 10 * 60 * 1000);
    const perIp = throttle(`profile-email-verify:ip:${ip ?? "unknown"}`, 30, 10 * 60 * 1000);
    if (!perUser.ok || !perIp.ok) {
      return fail("Too many attempts. Please try again later.", 429, { code: "RATE_LIMITED" });
    }

    const result = await verifyEmailOtp(email, parsed.data.code);
    if (!result.ok) return fail(result.error, 401, { code: "OTP_FAILED" });

    const owner = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: user.id } },
      select: { id: true },
    });
    if (owner) return fail(EMAIL_TAKEN, 409, { code: "EMAIL_TAKEN" });

    let updated;
    try {
      updated = await db.user.update({ where: { id: user.id }, data: { email, emailVerified: true } });
    } catch (err) {
      if (isUniqueViolation(err, ["email"])) return fail(EMAIL_TAKEN, 409, { code: "EMAIL_TAKEN" });
      throw err;
    }

    await audit({
      actorUserId: user.id,
      action: "PROFILE_EMAIL_VERIFIED",
      entityType: "User",
      entityId: user.id,
    });
    return NextResponse.json({ user: toAuthUser(updated) });
  });
}
