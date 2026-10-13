import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { changeSubscriptionBilling } from "@/lib/services/subscriptions";
import { audit } from "@/lib/services/audit";
import { run, fail } from "@/lib/api";

export const runtime = "nodejs";

// Student self-service resume: resumes billing on the real Razorpay subscription. Local state
// follows Razorpay's response; the subscription.resumed webhook re-applies it idempotently.
export async function POST(_req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can resume their membership", 403);
    }
    const sub = await db.subscription.findFirst({
      where: { userId: user.id, status: "HALTED" },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) return fail("No paused subscription to resume", 404, { code: "NO_HALTED" });

    const status = await changeSubscriptionBilling(sub, "resume");
    await audit({
      actorUserId: user.id,
      action: "MEMBERSHIP_RESUMED",
      entityType: "Subscription",
      entityId: sub.id,
    });
    return NextResponse.json({ ok: true, status });
  });
}
