import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { changeSubscriptionBilling } from "@/lib/services/subscriptions";
import { audit } from "@/lib/services/audit";
import { run, fail } from "@/lib/api";

export const runtime = "nodejs";

// Student self-service cancel: stops future auto-debits on Razorpay. Access continues until the end
// of the period already paid for.
export async function POST(_req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can cancel their membership", 403);
    }
    const sub = await db.subscription.findFirst({
      where: { userId: user.id, status: { in: ["ACTIVE", "HALTED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) return fail("No subscription to cancel", 404, { code: "NO_SUB" });

    // A paused subscription has no billing cycle left to finish, so cancel it outright.
    const status = await changeSubscriptionBilling(sub, sub.status === "ACTIVE" ? "cancel_at_cycle_end" : "cancel_now");
    await audit({
      actorUserId: user.id,
      action: "MEMBERSHIP_CANCELLED",
      entityType: "Subscription",
      entityId: sub.id,
    });
    return NextResponse.json({ ok: true, status });
  });
}
