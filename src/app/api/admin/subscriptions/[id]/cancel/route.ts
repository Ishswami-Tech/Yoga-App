import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound, fail } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { changeSubscriptionBilling } from "@/lib/services/subscriptions";

export const runtime = "nodejs";

// Cancel a subscription on Razorpay (real API call). Local state follows Razorpay's response and
// the subscription.cancelled webhook re-applies it idempotently.
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

    // Real Razorpay cancellation; the student keeps access until the paid period ends.
    await changeSubscriptionBilling(sub, "cancel_now");

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
