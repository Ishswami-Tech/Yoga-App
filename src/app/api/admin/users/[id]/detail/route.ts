import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound } from "@/lib/api";
import { getAttendanceSummary } from "@/lib/services/attendance";

export const runtime = "nodejs";

// Admin user detail drawer — returns everything the admin needs to see
// about a student in one call: profile, subscriptions, payments, attendance
// summary (streak/total/rate), and recent attendances.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    await requireRole("ADMIN");
    const { id } = await ctx.params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        whatsappNumber: true,
        createdAt: true,
      },
    });
    if (!user) return notFound("User");

    const [subscriptions, payments, attendance] = await Promise.all([
      db.subscription.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.payment.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      getAttendanceSummary(id),
    ]);

    // Today's class for this student (if any) — so the admin can see/copy
    // the Meet link.
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysClasses = await db.yogaClass.findMany({
      where: { date: todayStr, status: { in: ["READY", "PENDING_MEET"] } },
      include: { schedule: { select: { name: true } } },
    });

    const activeSub = subscriptions.find((s) => s.status === "ACTIVE");

    return NextResponse.json({
      user,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        razorpaySubscriptionId: s.razorpaySubscriptionId,
        status: s.status,
        amount: s.amount,
        currency: s.currency,
        startDate: s.startDate,
        endDate: s.endDate,
        nextBillingDate: s.nextBillingDate,
        createdAt: s.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        gatewayFee: p.gatewayFee,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      attendance,
      activeMembership: activeSub
        ? {
            endDate: activeSub.endDate,
            nextBillingDate: activeSub.nextBillingDate,
            amount: activeSub.amount,
          }
        : null,
      todaysClasses: todaysClasses.map((c) => ({
        id: c.id,
        scheduleName: c.schedule.name,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        meetUrl: c.meetUrl,
      })),
    });
  });
}
