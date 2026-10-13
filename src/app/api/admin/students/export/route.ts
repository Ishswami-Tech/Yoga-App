import { APP_NAME } from "@/lib/brand";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Export all students as CSV for CRM / accounting.
// Columns: Name, Email, Phone, WhatsApp, Role, Status, Membership, Next billing, End date, Total paid, Attendance count, Joined
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    const users = await db.user.findMany({
      where: { role: "STUDENT" },
      include: {
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
        payments: { where: { status: "CAPTURED" }, select: { amount: true } },
        attendances: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const esc = (v: string | number | null | undefined) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows: string[] = [];
    rows.push(`# ${APP_NAME} — Students Export`);
    rows.push(`# Generated: ${new Date().toISOString()}`);
    rows.push("");
    rows.push("Name,Email,Phone,WhatsApp,Status,Membership,Next billing,End date,Total paid (INR),Attendance count,Joined");

    for (const u of users) {
      const sub = u.subscriptions[0];
      const totalPaid = u.payments.reduce((a, p) => a + p.amount, 0);
      rows.push(
        [
          esc(u.name),
          esc(u.email),
          esc(u.phone),
          esc(u.whatsappNumber),
          esc(u.status),
          esc(sub?.status ?? "NONE"),
          esc(sub?.nextBillingDate?.toISOString().slice(0, 10) ?? ""),
          esc(sub?.endDate?.toISOString().slice(0, 10) ?? ""),
          (totalPaid / 100).toFixed(2),
          u.attendances.length,
          esc(u.createdAt.toISOString().slice(0, 10)),
        ]
          .map(esc)
          .join(",")
      );
    }

    const csv = rows.join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prana-yoga-students-${stamp}.csv"`,
      },
    });
  });
}
