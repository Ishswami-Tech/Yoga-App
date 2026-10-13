import { APP_NAME } from "@/lib/brand";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Export the same analytics bundle as CSV for accounting.
//
// Returns a single CSV file with multiple sections separated by blank rows:
//   1. Monthly revenue (month, revenue, fees, net, count)
//   2. Subscription state distribution (status, count)
//   3. Class status distribution (status, count)
//   4. WhatsApp delivery (status, count)
//   5. Daily classes (date, count)
//   6. Recent payments (date, student, amount, status, payment id)
//
// This is a pragmatic single-file export — Excel and Google Sheets both
// handle multi-section CSV cleanly with blank-row separators.
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    const now = new Date();
    const months: { key: string; label: string; revenue: number; fees: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
      months.push({ key, label, revenue: 0, fees: 0, count: 0 });
    }
    const monthMap = new Map(months.map((m) => [m.key, m]));

    const payments = await db.payment.findMany({
      where: { status: "CAPTURED", paidAt: { not: null } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { paidAt: "desc" },
    });
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

    const subs = await db.subscription.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
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

    const waMessages = await db.whatsAppMessage.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { status: true },
    });
    const waByStatus = waMessages.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});

    const dailyClasses: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400 * 1000);
      const ds = d.toISOString().slice(0, 10);
      const c = await db.yogaClass.count({ where: { date: ds } });
      dailyClasses.push({ date: ds, count: c });
    }

    // --- Build CSV ---
    const rows: string[] = [];
    const esc = (v: string | number | null | undefined) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    rows.push(`# ${APP_NAME} — Analytics Export`);
    rows.push(`# Generated: ${now.toISOString()}`);
    rows.push("");

    rows.push("## Monthly revenue (last 12 months)");
    rows.push("Month,Revenue (INR),Gateway fees (INR),Net (INR),Payments");
    for (const m of months) {
      rows.push(
        [esc(m.label), (m.revenue / 100).toFixed(2), (m.fees / 100).toFixed(2), ((m.revenue - m.fees) / 100).toFixed(2), m.count]
          .map(esc)
          .join(",")
      );
    }
    rows.push("");

    rows.push("## Subscription state distribution");
    rows.push("Status,Count");
    for (const s of subs) {
      rows.push([esc(s.status), s._count._all].map(esc).join(","));
    }
    rows.push("");

    rows.push("## Class status (last 30 days)");
    rows.push("Status,Count");
    for (const [status, count] of Object.entries(classByStatus)) {
      rows.push([esc(status), count].map(esc).join(","));
    }
    rows.push("");

    rows.push("## WhatsApp delivery (last 30 days)");
    rows.push("Status,Count");
    for (const [status, count] of Object.entries(waByStatus)) {
      rows.push([esc(status), count].map(esc).join(","));
    }
    rows.push("");

    rows.push("## Daily classes generated (last 14 days)");
    rows.push("Date,Count");
    for (const d of dailyClasses) {
      rows.push([esc(d.date), d.count].map(esc).join(","));
    }
    rows.push("");

    rows.push("## Recent captured payments");
    rows.push("Payment date,Student,Email,Amount (INR),Gateway fee (INR),Razorpay payment ID");
    for (const p of payments.slice(0, 200)) {
      rows.push(
        [
          esc(p.paidAt?.toISOString().slice(0, 19) ?? ""),
          esc(p.user?.name ?? ""),
          esc(p.user?.email ?? ""),
          (p.amount / 100).toFixed(2),
          ((p.gatewayFee ?? 0) / 100).toFixed(2),
          esc(p.razorpayPaymentId),
        ]
          .map(esc)
          .join(",")
      );
    }

    const csv = rows.join("\n");
    const stamp = now.toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prana-yoga-analytics-${stamp}.csv"`,
      },
    });
  });
}
