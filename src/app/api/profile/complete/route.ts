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
// Finishes the profile of a phone-only signup (name, real email, accepted terms). Idempotent:
// calling it again just updates name/email the same way.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = profileCompleteSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { name, email } = parsed.data;

    const owner = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== user.id) return fail(EMAIL_TAKEN, 409, { code: "EMAIL_TAKEN" });

    let updated;
    try {
      updated = await db.user.update({
        where: { id: user.id },
        data: { name, email, profileCompletedAt: new Date() },
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
