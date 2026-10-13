import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { run } from "@/lib/api";
import { istDateString } from "@/lib/services/scheduling";

export const runtime = "nodejs";

// Student practice journal — a 90-day attendance heatmap.
//
// Returns a list of { date, attended, className } entries for the last 90
// days, plus summary stats (streak, total, attendance rate). The student
// "Practice Journal" view renders this as a calendar-style heatmap.
export async function GET() {
  return run(async () => {
    const user = await requireAuth();

    // Fetch all attendances for this user with class details.
    const attendances = await db.attendance.findMany({
      where: { userId: user.id },
      include: {
        yogaClass: {
          include: { schedule: { select: { name: true } } },
        },
      },
      orderBy: { yogaClass: { date: "desc" } },
    });

    // Build a map of date -> { attended, className }
    const attendedByDate = new Map<string, { className: string }>();
    for (const a of attendances) {
      if (a.yogaClass) {
        attendedByDate.set(a.yogaClass.date, {
          className: a.yogaClass.schedule?.name ?? "Yoga Class",
        });
      }
    }

    // Build the 90-day calendar.
    const days: { date: string; attended: boolean; className: string | null }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400 * 1000);
      const ds = istDateString(d);
      const att = attendedByDate.get(ds);
      days.push({
        date: ds,
        attended: !!att,
        className: att?.className ?? null,
      });
    }

    // Also get all class days in the last 90 days (to distinguish "no class"
    // from "missed class" in the heatmap).
    const cutoff = istDateString(new Date(Date.now() - 90 * 86400 * 1000));
    const classDays = await db.yogaClass.findMany({
      where: { date: { gte: cutoff }, status: { in: ["READY", "COMPLETED"] } },
      select: { date: true },
    });
    const classDaySet = new Set(classDays.map((c) => c.date));

    // Compute attendance rate (attended / class days where student was a member).
    // For simplicity, rate = attended / class days in the last 90 days.
    const classDaysInWindow = days.filter((d) => classDaySet.has(d.date));
    const attendedCount = days.filter((d) => d.attended).length;
    const rate =
      classDaysInWindow.length > 0
        ? Math.round((attendedCount / classDaysInWindow.length) * 100)
        : 0;

    return NextResponse.json({
      days: days.map((d) => ({
        ...d,
        hadClass: classDaySet.has(d.date),
      })),
      stats: {
        attendedCount,
        classDaysCount: classDaysInWindow.length,
        attendanceRate: rate,
      },
    });
  });
}
