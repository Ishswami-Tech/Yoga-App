import { NextRequest } from "next/server";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { getMembershipState } from "@/lib/services/subscriptions";
import { run, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

// Current user's subscription/membership summary.
export async function GET(_req: NextRequest) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
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
            razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          }
        : null,
    };
  });
}

export async function _unused() {
  // ensures requireAuth import is referenced if tree-shake complains
  void requireAuth;
}
