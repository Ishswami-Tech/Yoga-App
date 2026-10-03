import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";
import { istDateString, addDays } from "@/lib/services/scheduling";

export const runtime = "nodejs";

export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    const [students, instructors, admins, activeSubs, payments, classesToday, whatsappToday, pendingMeets, failedMessages, recentWebhooks] =
      await Promise.all([
        db.user.count({ where: { role: "STUDENT" } }),
        db.user.count({ where: { role: "INSTRUCTOR" } }),
        db.user.count({ where: { role: "ADMIN" } }),
        db.subscription.count({ where: { status: "ACTIVE" } }),
        db.payment.count(),
        db.yogaClass.count({ where: { date: istDateString(new Date()) } }),
        db.whatsAppMessage.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        db.yogaClass.count({ where: { status: "PENDING_MEET" } }),
        db.whatsAppMessage.count({ where: { status: "FAILED" } }),
        db.webhookEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

    const totalRevenueResult = await db.payment.aggregate({
      _sum: { amount: true },
      where: { status: "CAPTURED" },
    });

    const todayStr = istDateString(new Date());
    const in7Str = istDateString(addDays(new Date(), 7));
    const upcoming = await db.yogaClass.findMany({
      where: {
        date: { gte: todayStr, lte: in7Str },
        status: "READY",
      },
      orderBy: { date: "asc" },
      take: 7,
      include: { schedule: true },
    });

    return NextResponse.json({
      counts: {
        students,
        instructors,
        admins,
        activeSubs,
        payments,
        classesToday,
        whatsappToday,
        pendingMeets,
        failedMessages,
      },
      revenue: {
        totalMinor: totalRevenueResult._sum.amount ?? 0,
        currency: "INR",
      },
      upcoming: upcoming.map((c) => ({
        id: c.id,
        date: c.date,
        startTime: c.startTime,
        scheduleName: c.schedule.name,
        status: c.status,
      })),
      recentWebhooks: recentWebhooks.map((w) => ({
        id: w.id,
        provider: w.provider,
        eventId: w.eventId,
        eventType: w.eventType,
        status: w.status,
        createdAt: w.createdAt,
      })),
    });
  });
}
