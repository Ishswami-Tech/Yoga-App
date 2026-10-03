import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership, getMembershipState } from "@/lib/services/subscriptions";
import { run } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    const { state, subscription } = await getMembershipState(user.id);
    return NextResponse.json({
      user,
      membership: {
        state,
        subscriptionId: subscription?.id ?? null,
        status: subscription?.status ?? null,
        startDate: subscription?.startDate ?? null,
        endDate: subscription?.endDate ?? null,
        nextBillingDate: subscription?.nextBillingDate ?? null,
        amount: subscription?.amount ?? null,
        currency: subscription?.currency ?? null,
        hasActive: await hasActiveMembership(user.id),
      },
    });
  });
}
