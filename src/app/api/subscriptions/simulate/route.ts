import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createSubscriptionForUser,
  applyRazorpayEvent,
} from "@/lib/services/subscriptions";
import { razorpay } from "@/lib/providers/razorpay";
import { db } from "@/lib/db";
import { run, fail } from "@/lib/api";

export const runtime = "nodejs";

// Dev/test harness: simulate the customer completing Razorpay Checkout and
// the subsequent Razorpay webhook. This drives the full membership
// activation flow without real credentials. Disabled in production by the
// DEV_HARNESS env guard inside run().
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can simulate a checkout", 403);
    }

    const body = await req.json().catch(() => ({}));
    let subscriptionId: string | undefined = body?.razorpaySubscriptionId;

    if (!subscriptionId) {
      const created = await createSubscriptionForUser({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
      });
      subscriptionId = created.razorpaySubscriptionId;
    }

    const local = await db.subscription.findUnique({
      where: { razorpaySubscriptionId: subscriptionId },
    });
    if (!local) return fail("Subscription not found", 404);

    const { paymentId, signature } = await razorpay.authorizeSubscription(
      subscriptionId
    );
    const event = razorpay.buildAuthorizedEvent(subscriptionId, paymentId);
    const eventId = `evt_${subscriptionId}_${Date.now()}`;
    await applyRazorpayEvent(event, eventId);

    return {
      ok: true,
      razorpaySubscriptionId: subscriptionId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
      webhookEventId: eventId,
    };
  });
}
