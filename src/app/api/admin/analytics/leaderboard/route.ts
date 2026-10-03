import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Admin revenue leaderboard — top students by total captured payment amount.
//
// Returns the top 10 students ranked by total revenue contributed, plus their
// payment count, attendance count, and current streak. This gives admins a
// quick view of who their most valuable members are.
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    // Aggregate payments by user
    const payments = await db.payment.findMany({
      where: { status: "CAPTURED" },
      select: { userId: true, amount: true },
    });

    const byUser = new Map<string, { total: number; count: number }>();
    for (const p of payments) {
      const entry = byUser.get(p.userId) ?? { total: 0, count: 0 };
      entry.total += p.amount;
      entry.count += 1;
      byUser.set(p.userId, entry);
    }

    // Get user details + attendance for the top contributors
    const topUserIds = [...byUser.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([userId]) => userId);

    const users = await db.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    // Get attendance counts for each user
    const attendanceCounts = await db.attendance.groupBy({
      by: ["userId"],
      where: { userId: { in: topUserIds } },
      _count: { _all: true },
    });
    const attMap = new Map(attendanceCounts.map((a) => [a.userId, a._count._all]));

    // Build the leaderboard, maintaining the sorted order
    const leaderboard = topUserIds.map((userId, i) => {
      const user = users.find((u) => u.id === userId)!;
      const pay = byUser.get(userId)!;
      return {
        rank: i + 1,
        userId,
        name: user?.name ?? "Unknown",
        email: user?.email ?? "",
        totalRevenue: pay.total,
        paymentCount: pay.count,
        attendanceCount: attMap.get(userId) ?? 0,
        joinedAt: user?.createdAt ?? null,
      };
    });

    return NextResponse.json({
      items: leaderboard,
      totalStudents: byUser.size,
      totalRevenue: payments.reduce((a, p) => a + p.amount, 0),
    });
  });
}
