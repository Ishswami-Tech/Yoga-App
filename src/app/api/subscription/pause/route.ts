import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { razorpay } from "@/lib/providers/razorpay";
import { applyRazorpayEvent } from "@/lib/services/subscriptions";
import { audit } from "@/lib/services/audit";
import { run, fail } from "@/lib/api";

export const runtime = "nodejs";

// Student self-service pause membership.
//
// Dispatches the subscription.halted event through the same verified-webhook
// path that real Razorpay halts use. The subscription goes to HALTED state,
// which means the student keeps access until endDate (end of current billing
// cycle) but no future charges will be attempted until they resume.
//
// In production, Razorpay halts a subscription after payment retries are
// exhausted. Here we let the student voluntarily pause.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can pause their membership", 403);
    }

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason as string | undefined;

    // Find the active subscription
    const sub = await db.subscription.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) {
      return fail("No active subscription to pause", 404, { code: "NO_SUB" });
    }

    // Dispatch the halted event
    const event = razorpay.buildHaltedEvent(sub.razorpaySubscriptionId);
    const eventId = `evt_pause_${sub.razorpaySubscriptionId}_${Date.now()}`;
    const res = await applyRazorpayEvent(event, eventId);
    if (!res.applied) {
      return fail(res.reason ?? "Webhook application failed", 500);
    }

    await audit({
      actorUserId: user.id,
      action: "MEMBERSHIP_PAUSED",
      entityType: "Subscription",
      entityId: sub.id,
      metadata: { reason: reason ?? "self-service" },
    });

    return NextResponse.json({ ok: true, status: "HALTED" });
  });
}
