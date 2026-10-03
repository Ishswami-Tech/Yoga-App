import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole("ADMIN");
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const items = await db.payment.findMany({
      where: { ...(userId ? { userId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } },
    });
    return NextResponse.json({
      items: items.map((p) => ({
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
        userName: p.user?.name,
        userEmail: p.user?.email,
      })),
    });
  });
}
