import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { razorpay } from "@/lib/providers/razorpay";
import { applyRazorpayEvent } from "@/lib/services/subscriptions";
import { audit } from "@/lib/services/audit";
import { run, fail } from "@/lib/api";

export const runtime = "nodejs";

// Student self-service resume membership.
//
// Dispatches a subscription.charged event (which re-activates the
// subscription) through the verified-webhook path. This simulates the
// student re-authorising the recurring payment.
export async function POST(_req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can resume their membership", 403);
    }

    // Find the halted subscription
    const sub = await db.subscription.findFirst({
      where: { userId: user.id, status: "HALTED" },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) {
      return fail("No halted subscription to resume", 404, { code: "NO_HALTED" });
    }

    // Dispatch a charged event to re-activate
    const event = razorpay.buildChargedEvent(sub.razorpaySubscriptionId, 1);
    const eventId = `evt_resume_${sub.razorpaySubscriptionId}_${Date.now()}`;
    const res = await applyRazorpayEvent(event, eventId);
    if (!res.applied) {
      return fail(res.reason ?? "Webhook application failed", 500);
    }

    await audit({
      actorUserId: user.id,
      action: "MEMBERSHIP_RESUMED",
      entityType: "Subscription",
      entityId: sub.id,
    });

    return NextResponse.json({ ok: true, status: "ACTIVE" });
  });
}
