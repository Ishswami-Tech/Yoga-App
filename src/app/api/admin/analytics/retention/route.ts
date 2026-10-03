import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Admin retention analysis — identifies students at risk of churning.
//
// Returns cohorts based on last-attended date:
//   - active: attended in the last 3 days
//   - engaged: attended in the last 7 days
//   - at-risk: attended 7-14 days ago (hasn't been to class recently)
//   - churning: attended 14-30 days ago
//   - churned: last attendance >30 days ago (or never attended)
//
// Also returns the overall retention rate (active + engaged) / total students.
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    const students = await db.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      include: {
        attendances: {
          include: { yogaClass: { select: { date: true } } },
          orderBy: { yogaClass: { date: "desc" } },
          take: 1,
        },
        subscriptions: {
          where: { status: "ACTIVE" },
          take: 1,
          select: { startDate: true, endDate: true },
        },
      },
    });

    const now = Date.now();
    const DAY = 86400 * 1000;

    const cohorts: {
      active: { id: string; name: string; email: string; lastClass: string | null; daysSince: number | null }[];
      engaged: typeof students_active;
      atRisk: typeof students_active;
      churning: typeof students_active;
      churned: typeof students_active;
    } = {
      active: [],
      engaged: [],
      atRisk: [],
      churning: [],
      churned: [],
    };

    // Reuse the same type
    type StudentWithAttendance = typeof students[number];
    const students_active: StudentWithAttendance[] = [];

    for (const s of students) {
      const lastAtt = s.attendances[0]?.yogaClass?.date;
      const lastMs = lastAtt ? Date.parse(lastAtt.slice(0, 4) + "-" + lastAtt.slice(4, 6) + "-" + lastAtt.slice(6, 8)) : null;

      // Actually, the date is stored as "YYYY-MM-DD" so we can parse directly
      const lastClassMs = lastAtt ? new Date(lastAtt + "T00:00:00Z").getTime() : null;
      const daysSince = lastClassMs ? Math.floor((now - lastClassMs) / DAY) : null;

      const entry = {
        id: s.id,
        name: s.name,
        email: s.email,
        lastClass: lastAtt,
        daysSince,
      };

      if (daysSince === null) {
        cohorts.churned.push(entry as any);
      } else if (daysSince <= 3) {
        cohorts.active.push(entry as any);
      } else if (daysSince <= 7) {
        cohorts.engaged.push(entry as any);
      } else if (daysSince <= 14) {
        cohorts.atRisk.push(entry as any);
      } else if (daysSince <= 30) {
        cohorts.churning.push(entry as any);
      } else {
        cohorts.churned.push(entry as any);
      }
    }

    const total = students.length;
    const retained = cohorts.active.length + cohorts.engaged.length;
    const retentionRate = total > 0 ? Math.round((retained / total) * 100) : 0;

    return NextResponse.json({
      cohorts: {
        active: { count: cohorts.active.length, students: cohorts.active },
        engaged: { count: cohorts.engaged.length, students: cohorts.engaged },
        atRisk: { count: cohorts.atRisk.length, students: cohorts.atRisk },
        churning: { count: cohorts.churning.length, students: cohorts.churning },
        churned: { count: cohorts.churned.length, students: cohorts.churned },
      },
      total,
      retained,
      retentionRate,
    });
  });
}
