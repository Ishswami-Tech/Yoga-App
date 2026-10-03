import { NextRequest } from "next/server";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { createSubscriptionForUser } from "@/lib/services/subscriptions";
import { run, fail, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

// Create a Razorpay subscription for the logged-in student and return the
// data the browser needs for Checkout. The actual membership activation
// happens only after the verified webhook arrives.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can subscribe", 403, { code: "FORBIDDEN" });
    }

    return createSubscriptionForUser({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
    });
  });
}

// GET returns the current user's subscription status (alias of /api/subscription).
export async function GET() {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { createSubscriptionForUser: _unused } = await import(
      "@/lib/services/subscriptions"
    );
    const { getMembershipState } = await import(
      "@/lib/services/subscriptions"
    );
    const { state, subscription } = await getMembershipState(user.id);
    return {
      state,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            amount: subscription.amount,
            currency: subscription.currency,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            nextBillingDate: subscription.nextBillingDate,
          }
        : null,
    };
  });
}
