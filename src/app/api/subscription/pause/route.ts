import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { changeSubscriptionBilling } from "@/lib/services/subscriptions";
import { audit } from "@/lib/services/audit";
import { run, fail } from "@/lib/api";

export const runtime = "nodejs";

// Student self-service pause: pauses billing on the real Razorpay subscription. The local state is
// updated from Razorpay's response; the subscription.paused webhook re-applies it idempotently.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can pause their membership", 403);
    }
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : undefined;

    const sub = await db.subscription.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) return fail("No active subscription to pause", 404, { code: "NO_SUB" });

    const status = await changeSubscriptionBilling(sub, "pause");
    await audit({
      actorUserId: user.id,
      action: "MEMBERSHIP_PAUSED",
      entityType: "Subscription",
      entityId: sub.id,
      metadata: { reason: reason ?? "self-service" },
    });
    return NextResponse.json({ ok: true, status });
  });
}
