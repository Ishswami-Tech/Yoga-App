import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Revenue forecast for the admin dashboard hero.
//
// Uses the last 6 months of captured payments to project the next 3 months
// with a TREND-AWARE weighted moving average:
//   - weightedAverage: weights recent months more heavily (linear weights
//     1..6 over the 6 months, so last month carries 6x the weight of the
//     oldest month). This captures momentum better than a flat average.
//   - trendSlope: the linear-regression slope of the 6 monthly revenue
//     points. Positive = growing, negative = shrinking.
//   - projected: weightedAverage + trendSlope * i for month i ahead. This
//     extrapolates the trend forward while anchoring on the weighted base.
//   - trend: "up" | "down" | "flat" — derived from the slope relative to
//     the weighted average (slope/weightedAverage > 5% = up, < -5% = down).
//   - mrr: monthly recurring revenue = active subscriptions * plan amount.
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    const now = new Date();
    const months: { key: string; label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      months.push({ key, label, revenue: 0 });
    }
    const monthMap = new Map(months.map((m) => [m.key, m]));

    const payments = await db.payment.findMany({
      where: { status: "CAPTURED", paidAt: { not: null } },
      select: { amount: true, paidAt: true },
    });
    for (const p of payments) {
      if (!p.paidAt) continue;
      const d = p.paidAt;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const m = monthMap.get(key);
      if (m) m.revenue += p.amount;
    }

    // --- Weighted moving average (linear weights 1..6, newest = 6) ---
    let weightedSum = 0;
    let weightTotal = 0;
    months.forEach((m, i) => {
      const w = i + 1; // i=0 (oldest) -> w=1, i=5 (newest) -> w=6
      weightedSum += m.revenue * w;
      weightTotal += w;
    });
    const weightedAverage = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

    // --- Simple flat average (for comparison) ---
    const total6 = months.reduce((a, m) => a + m.revenue, 0);
    const monthlyAverage = Math.round(total6 / 6);

    // --- Linear regression slope (least squares) ---
    // x = 0..5 (month index), y = revenue. slope = cov(x,y)/var(x).
    const n = months.length;
    const xMean = (n - 1) / 2; // 2.5 for n=6
    const yMean = total6 / n;
    let cov = 0;
    let varX = 0;
    months.forEach((m, i) => {
      cov += (i - xMean) * (m.revenue - yMean);
      varX += (i - xMean) ** 2;
    });
    const trendSlope = varX > 0 ? cov / varX : 0; // paise per month

    // --- Trend label from slope relative to weighted average ---
    let trend: "up" | "down" | "flat" = "flat";
    if (weightedAverage > 0) {
      const ratio = trendSlope / weightedAverage;
      if (ratio > 0.05) trend = "up";
      else if (ratio < -0.05) trend = "down";
    }

    // --- Month-over-month change (for the % display) ---
    const lastMonth = months[months.length - 1]?.revenue ?? 0;
    const prevMonth = months[months.length - 2]?.revenue ?? 0;
    let trendPct = 0;
    if (prevMonth > 0) {
      trendPct = Math.round(((lastMonth - prevMonth) / prevMonth) * 100);
    }

    // --- MRR = active subscriptions * plan amount (50000 paise) ---
    const activeCount = await db.subscription.count({ where: { status: "ACTIVE" } });
    const mrr = activeCount * 50000;

    // --- Projected next 3 months (trend-aware) ---
    // projected[i] = weightedAverage + trendSlope * i  (i = 1, 2, 3)
    // Clamp to >= 0 so a negative trend never projects below zero.
    const projected: { month: string; projected: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      const projected_val = Math.max(0, Math.round(weightedAverage + trendSlope * i));
      projected.push({ month: label, projected: projected_val });
    }

    return NextResponse.json({
      monthlyAverage,
      weightedAverage,
      trendSlope: Math.round(trendSlope),
      mrr,
      trend,
      trendPct,
      lastMonthRevenue: lastMonth,
      historical: months.map((m) => ({ month: m.label, revenue: m.revenue })),
      projected,
      activeCount,
    });
  });
}
