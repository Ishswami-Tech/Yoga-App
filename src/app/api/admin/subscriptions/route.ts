import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// List all subscriptions across users (admin overview).
export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole("ADMIN");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const items = await db.subscription.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } },
    });
    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        razorpaySubscriptionId: s.razorpaySubscriptionId,
        razorpayPlanId: s.razorpayPlanId,
        status: s.status,
        amount: s.amount,
        currency: s.currency,
        startDate: s.startDate,
        endDate: s.endDate,
        nextBillingDate: s.nextBillingDate,
        createdAt: s.createdAt,
        userName: s.user?.name,
        userEmail: s.user?.email,
      })),
    });
  });
}
