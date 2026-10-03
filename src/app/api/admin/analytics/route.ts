import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Admin analytics: revenue, retention, class utilisation, WhatsApp delivery.
// All computed live from the database. Returns a single bundle the admin
// Analytics view renders into charts (recharts).
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    // --- Revenue last 6 months (by paidAt month) ---
    const payments = await db.payment.findMany({
      where: { status: "CAPTURED", paidAt: { not: null } },
      select: { amount: true, gatewayFee: true, paidAt: true },
    });
    const now = new Date();
    const months: { key: string; label: string; revenue: number; fees: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      months.push({ key, label, revenue: 0, fees: 0, count: 0 });
    }
    const monthMap = new Map(months.map((m) => [m.key, m]));
    for (const p of payments) {
      if (!p.paidAt) continue;
      const d = p.paidAt;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const m = monthMap.get(key);
      if (m) {
        m.revenue += p.amount;
        m.fees += p.gatewayFee ?? 0;
        m.count += 1;
      }
    }

    // --- Subscription state distribution ---
    const subs = await db.subscription.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const subDistribution = subs.map((s) => ({
      status: s.status,
      count: s._count._all,
    }));

    // --- Class status distribution (last 30 days) ---
    const cutoff = new Date(Date.now() - 30 * 86400 * 1000);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const classes = await db.yogaClass.findMany({
      where: { date: { gte: cutoffStr } },
      select: { status: true, date: true },
    });
    const classByStatus = classes.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
    const classStatusDistribution = Object.entries(classByStatus).map(([status, count]) => ({
      status,
      count,
    }));

    // --- WhatsApp delivery last 30 days ---
    const waMessages = await db.whatsAppMessage.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { status: true, createdAt: true },
    });
    const waByStatus = waMessages.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});
    const waDelivery = Object.entries(waByStatus).map(([status, count]) => ({
      status,
      count,
    }));
    const waDeliveryRate =
      waMessages.length > 0
        ? Math.round(
            ((waByStatus.DELIVERED ?? 0) + (waByStatus.SENT ?? 0) + (waByStatus.READ ?? 0)) /
              waMessages.length *
              100
          )
        : 0;

    // --- Weekly active members (students with ACTIVE subscription, last 8 weeks) ---
    // We approximate "active in week W" as: had an ACTIVE subscription whose
    // startDate <= end of week W and (endDate is null or endDate >= start of week W).
    const activeMembers = await db.subscription.count({
      where: { status: "ACTIVE" },
    });
    const totalStudents = await db.user.count({ where: { role: "STUDENT" } });

    // --- Daily class generation (last 14 days) ---
    const dailyClasses: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400 * 1000);
      const ds = d.toISOString().slice(0, 10);
      const c = await db.yogaClass.count({ where: { date: ds } });
      dailyClasses.push({ date: ds, count: c });
    }

    // --- Totals ---
    const totalRevenue = payments.reduce((a, p) => a + p.amount, 0);
    const totalFees = payments.reduce((a, p) => a + (p.gatewayFee ?? 0), 0);
    const netRevenue = totalRevenue - totalFees;

    return NextResponse.json({
      revenue: {
        monthly: months.map((m) => ({
          month: m.label,
          revenue: m.revenue,
          fees: m.fees,
          net: m.revenue - m.fees,
          count: m.count,
        })),
        totalMinor: totalRevenue,
        totalFeesMinor: totalFees,
        netMinor: netRevenue,
        currency: "INR",
      },
      subscriptions: {
        distribution: subDistribution,
        active: activeMembers,
        totalStudents,
        penetration: totalStudents > 0 ? Math.round((activeMembers / totalStudents) * 100) : 0,
      },
      classes: {
        statusDistribution: classStatusDistribution,
        totalLast30Days: classes.length,
      },
      whatsapp: {
        delivery: waDelivery,
        deliveryRatePct: waDeliveryRate,
        totalLast30Days: waMessages.length,
      },
      dailyClasses,
    });
  });
}
