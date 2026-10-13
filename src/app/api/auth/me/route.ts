import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership, getMembershipState, summarizeMembership } from "@/lib/services/subscriptions";
import { run } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    const current = await getMembershipState(user.id);
    const summary = summarizeMembership(current);
    return NextResponse.json({
      user,
      membership: {
        state: current.state,
        subscriptionId: summary?.id ?? null,
        status: summary?.status ?? null,
        startDate: summary?.startDate ?? null,
        endDate: summary?.endDate ?? null,
        nextBillingDate: summary?.nextBillingDate ?? null,
        amount: summary?.amount ?? null,
        currency: summary?.currency ?? null,
        hasActive: await hasActiveMembership(user.id),
      },
    });
  });
}
