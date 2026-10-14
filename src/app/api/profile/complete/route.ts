import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, toAuthUser } from "@/lib/auth";
import { profileCompleteSchema } from "@/lib/validation";
import { run, fromZodError, fail } from "@/lib/api";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

const EMAIL_TAKEN = "This email is already registered. Use a different email.";

// POST /api/profile/complete
//
// Finishes the profile (name, accepted terms, and a real email when the account only has the
// phone-signup placeholder). Requires a verified WhatsApp number first, whatever the sign-in method.
// Idempotent: calling it again just updates name/email the same way.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = profileCompleteSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { name } = parsed.data;

    if (!user.whatsappNumber) {
      return fail("Please verify your WhatsApp number first.", 409, { code: "PHONE_REQUIRED" });
    }

    // Required only while the account still has the placeholder address.
    if (user.emailIsPlaceholder && !parsed.data.email) {
      return fail("Validation failed", 422, {
        code: "VALIDATION",
        details: [{ path: ["email"], message: "Enter a valid email address" }],
      });
    }
    const newEmail =
      parsed.data.email && parsed.data.email !== user.email.toLowerCase() ? parsed.data.email : undefined;

    if (newEmail) {
      const owner = await db.user.findUnique({ where: { email: newEmail }, select: { id: true } });
      if (owner && owner.id !== user.id) return fail(EMAIL_TAKEN, 409, { code: "EMAIL_TAKEN" });
    }

    let updated;
    try {
      updated = await db.user.update({
        where: { id: user.id },
        // A changed address is unverified until the owner proves it.
        data: { name, profileCompletedAt: new Date(), ...(newEmail ? { email: newEmail, emailVerified: false } : {}) },
      });
    } catch (err) {
      // Lost a race with another account claiming the same address.
      if (isUniqueViolation(err, ["email"])) return fail(EMAIL_TAKEN, 409, { code: "EMAIL_TAKEN" });
      throw err;
    }

    await audit({
      actorUserId: user.id,
      action: "PROFILE_COMPLETE",
      entityType: "User",
      entityId: user.id,
    });
    return NextResponse.json({ user: toAuthUser(updated) });
  });
}
