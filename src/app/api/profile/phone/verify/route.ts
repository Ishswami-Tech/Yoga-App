import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, toAuthUser } from "@/lib/auth";
import { verifyOtp } from "@/lib/providers/otp";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizePhone, phoneCandidates, toCanonical } from "@/lib/phone";
import { clientIp, throttle } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { audit } from "@/lib/services/audit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(7).max(24),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const PHONE_TAKEN = "This number is already registered with another account. Sign in with that number instead.";
const ALREADY_SET = "A WhatsApp number is already linked to this account.";

// POST /api/profile/phone/verify
//
// Confirms the WhatsApp code and links the number (whatsappNumber + phone) to the signed-in user.
// The update is guarded (only while the account has no number) so concurrent calls cannot overwrite.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return fail("Enter a valid WhatsApp number", 422, { code: "INVALID_PHONE" });

    const ip = clientIp(req);
    const perUser = throttle(`phone-link-verify:u:${user.id}`, 10, 10 * 60 * 1000);
    const perIp = throttle(`phone-link-verify:ip:${ip ?? "unknown"}`, 30, 10 * 60 * 1000);
    if (!perUser.ok || !perIp.ok) {
      return fail("Too many attempts. Please try again later.", 429, { code: "RATE_LIMITED" });
    }

    if (user.whatsappNumber) return fail(ALREADY_SET, 409, { code: "PHONE_ALREADY_SET" });

    const owner = await db.user.findFirst({
      where: { whatsappNumber: { in: phoneCandidates(phone) }, id: { not: user.id } },
      select: { id: true },
    });
    if (owner) return fail(PHONE_TAKEN, 409, { code: "PHONE_TAKEN" });

    const result = await verifyOtp(phone, parsed.data.code);
    if (!result.ok) return fail(result.error, 401, { code: "OTP_FAILED" });

    const canonical = toCanonical(phone);
    try {
      const linked = await db.user.updateMany({
        where: { id: user.id, whatsappNumber: null },
        data: { whatsappNumber: canonical, phone: canonical },
      });
      if (linked.count !== 1) return fail(ALREADY_SET, 409, { code: "PHONE_ALREADY_SET" });
    } catch (err) {
      if (isUniqueViolation(err, ["whatsappNumber"])) return fail(PHONE_TAKEN, 409, { code: "PHONE_TAKEN" });
      throw err;
    }

    const updated = await db.user.findUnique({ where: { id: user.id } });
    if (!updated) throw new Error("UNAUTHORIZED");

    await audit({ actorUserId: user.id, action: "PHONE_LINKED", entityType: "User", entityId: user.id });
    return NextResponse.json({ user: toAuthUser(updated) });
  });
}
