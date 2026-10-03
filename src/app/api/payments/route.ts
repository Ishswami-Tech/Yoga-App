import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Payment history for the logged-in student.
export async function GET() {
  return run(async () => {
    const user = await requireAuth();
    const payments = await db.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { subscription: true },
    });
    return NextResponse.json({
      items: payments.map((p) => ({
        id: p.id,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        gatewayFee: p.gatewayFee,
        surcharge: p.surcharge,
        surchargeGst: p.surchargeGst,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        subscriptionStatus: p.subscription?.status ?? null,
      })),
    });
  });
}
