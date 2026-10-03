import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Admin schedule calendar — returns a month grid of class data.
//
// Query params: ?year=2026&month=9 (1-12). Defaults to current IST month.
// Returns:
//   - days: array of { date, day, isInMonth, classes: [{id, scheduleName,
//     startTime, endTime, status, meetUrl}], exception: {type, reason}|null }
//   - schedules: list of active schedules for legend
//   - monthLabel: "September 2026"
//
// The calendar shows all days of the month (including padding from adjacent
// months to fill the grid), with class chips and exception badges overlaid.
export async function GET(req: Request) {
  return run(async () => {
    await requireRole(["ADMIN", "INSTRUCTOR"]);
    const url = new URL(req.url);
    const now = new Date();
    const year = parseInt(url.searchParams.get("year") ?? String(now.getUTCFullYear()), 10);
    const month = parseInt(url.searchParams.get("month") ?? String(now.getUTCMonth() + 1), 10);

    // Build the month grid. Start from the first day of the month, then
    // pad backwards to Sunday and forwards to Saturday so the grid is full.
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const firstDayOfWeek = firstOfMonth.getUTCDay(); // 0=Sun
    const startOffset = firstDayOfWeek; // days to go back to Sunday

    const gridStart = new Date(firstOfMonth);
    gridStart.setUTCDate(gridStart.getUTCDate() - startOffset);

    // Generate 42 days (6 weeks) to fill the grid.
    const days: {
      date: string;
      day: number;
      isInMonth: boolean;
      weekday: number;
      classes: {
        id: string;
        scheduleName: string;
        startTime: string;
        endTime: string;
        status: string;
        meetUrl: string | null;
        scheduleId: string;
      }[];
      exception: { type: string; reason: string | null } | null;
    }[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const isInMonth = d.getUTCMonth() === month - 1 && d.getUTCFullYear() === year;

      const [classes, exception] = await Promise.all([
        db.yogaClass.findMany({
          where: { date: dateStr },
          include: { schedule: { select: { name: true, id: true } } },
          orderBy: { startTime: "asc" },
        }),
        db.classException.findFirst({
          where: { date: dateStr },
          include: { schedule: { select: { name: true } } },
        }),
      ]);

      days.push({
        date: dateStr,
        day: d.getUTCDate(),
        isInMonth,
        weekday: d.getUTCDay(),
        classes: classes.map((c) => ({
          id: c.id,
          scheduleName: c.schedule.name,
          scheduleId: c.schedule.id,
          startTime: c.startTime,
          endTime: c.endTime,
          status: c.status,
          meetUrl: c.meetUrl,
        })),
        exception: exception
          ? { type: exception.type, reason: exception.reason }
          : null,
      });
    }

    // Active schedules for the legend.
    const schedules = await db.classSchedule.findMany({
      where: { active: true },
      select: { id: true, name: true, startTime: true, endTime: true,
        monday: true, tuesday: true, wednesday: true, thursday: true,
        friday: true, saturday: true, sunday: true },
      orderBy: { startTime: "asc" },
    });

    const monthLabel = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(firstOfMonth);

    return NextResponse.json({
      days,
      schedules: schedules.map((s) => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        weekdays: [s.sunday, s.monday, s.tuesday, s.wednesday, s.thursday, s.friday, s.saturday],
      })),
      monthLabel,
      year,
      month,
    });
  });
}
