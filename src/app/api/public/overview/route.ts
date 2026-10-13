import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { run } from "@/lib/api";
import { istDateString } from "@/lib/services/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS = [
  ["sunday", "Sun"],
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
] as const;

// Public, read-only, PII-free overview for the landing page: the active schedules,
// the instructor's first name and the next class date. Everything comes from the DB;
// when nothing is configured the arrays are empty / null and the UI shows an empty state.
export async function GET() {
  return run(async () => {
    const today = istDateString(new Date());
    const [schedules, instructor, nextClass] = await Promise.all([
      db.classSchedule.findMany({
        where: { active: true },
        orderBy: [{ startTime: "asc" }, { name: "asc" }],
      }),
      db.user.findFirst({
        where: { role: "INSTRUCTOR", status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { name: true },
      }),
      db.yogaClass.findFirst({
        where: { date: { gte: today }, status: { in: ["READY", "PENDING_MEET"] }, schedule: { active: true } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: { date: true, startTime: true, endTime: true, schedule: { select: { name: true } } },
      }),
    ]);

    const items = schedules.map((s) => ({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      weekdays: DAYS.filter(([k]) => s[k]).map(([, label]) => label),
    }));
    const days = new Set(items.flatMap((i) => i.weekdays));

    return NextResponse.json(
      {
        instructorFirstName: instructor?.name?.trim().split(/\s+/)[0] || null,
        schedules: items,
        classDaysPerWeek: days.size,
        nextClass: nextClass
          ? {
              date: nextClass.date,
              startTime: nextClass.startTime,
              endTime: nextClass.endTime,
              scheduleName: nextClass.schedule.name,
            }
          : null,
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } }
    );
  });
}
