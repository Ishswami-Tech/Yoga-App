import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound, fail } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { razorpay } from "@/lib/providers/razorpay";
import { applyRazorpayEvent } from "@/lib/services/subscriptions";

export const runtime = "nodejs";

// Cancel an active subscription.
//
// This mirrors the real Razorpay "subscription.cancelled" webhook flow:
// the adapter emits a cancelled event, applyRazorpayEvent verifies it
// idempotently (via the WebhookEvent table) and updates the Subscription
// status to CANCELLED inside a Prisma transaction. The student keeps
// access until endDate (end of the current billing cycle).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const sub = await db.subscription.findUnique({ where: { id } });
    if (!sub) return notFound("Subscription");
    if (sub.status === "CANCELLED") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }
    if (sub.status === "EXPIRED" || sub.status === "FAILED") {
      return fail(
        `Cannot cancel a ${sub.status} subscription`,
        409,
        { code: "INVALID_STATE" }
      );
    }

    // Build the synthetic "subscription.cancelled" Razorpay event and run it
    // through the same verified-webhook path that real cancellations use.
    const event = razorpay.buildCancelledEvent(sub.razorpaySubscriptionId);
    const eventId = `evt_cancel_${sub.razorpaySubscriptionId}_${Date.now()}`;
    const res = await applyRazorpayEvent(event, eventId);
    if (!res.applied) {
      return fail(
        res.reason ?? "Webhook application failed",
        500,
        { code: "WEBHOOK" }
      );
    }

    await audit({
      actorUserId: admin.id,
      action: "SUBSCRIPTION_CANCEL",
      entityType: "Subscription",
      entityId: id,
      metadata: {
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        previousStatus: sub.status,
      },
    });
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  });
}
