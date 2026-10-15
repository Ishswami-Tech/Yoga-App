import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership } from "@/lib/services/subscriptions";
import { istDateString, istWeekday, istDateTime } from "@/lib/services/scheduling";
import { meetAvailableAt } from "@/lib/services/meet-window";
import { pickBestClass } from "@/lib/services/class-pick";
import { getMeetLeadMinutes } from "@/lib/services/class-generator";
import { run, unauthorized, forbidden, notFound } from "@/lib/api";

export const runtime = "nodejs";

// Today's authorized class. Active membership required to receive the
// meetUrl. Inactive members still see that a class exists today but the
// join link is withheld.
export async function GET() {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const todayStr = istDateString(new Date());
    const today = new Date();
    const weekday = istWeekday(today);

    // Find a READY class for today across all active schedules whose weekday
    // flag matches and that has no NO_CLASS exception for today.
    const classes = await db.yogaClass.findMany({
      where: { date: todayStr, status: { in: ["READY", "PENDING_MEET"] } },
      include: { schedule: true },
    });

    // Filter by weekday + exception client-side (weekday flags are columns
    // not easily queryable through Prisma).
    // One batched exception lookup for every schedule that has a class today.
    const holidays = await db.classException.findMany({
      where: {
        date: todayStr,
        type: "NO_CLASS",
        scheduleId: { in: classes.map((c) => c.scheduleId) },
      },
      select: { scheduleId: true },
    });
    const holidayIds = new Set(holidays.map((h) => h.scheduleId));
    const eligible = classes.filter(
      (cls) =>
        cls.schedule.active &&
        weekdayFlag(cls.schedule, weekday) &&
        !holidayIds.has(cls.scheduleId)
    );

    const best = pickBestClass(eligible, today);
    if (!best) return notFound("Today's class");

    const active = await hasActiveMembership(user.id);
    const isStaff = user.role === "INSTRUCTOR" || user.role === "ADMIN";

    const leadMinutes = await getMeetLeadMinutes();
    const toItem = (cls: (typeof eligible)[number]) => ({
      id: cls.id,
      date: cls.date,
      startTime: cls.startTime,
      endTime: cls.endTime,
      status: cls.status,
      scheduleName: cls.schedule.name,
      hasMeet: Boolean(cls.meetUrl),
      meetAvailableAt: meetAvailableAt(istDateTime(cls.date, cls.startTime), leadMinutes).toISOString(),
      meetUrl: active || isStaff ? cls.meetUrl : null,
      reminderSent: Boolean(cls.reminderSentAt),
      canJoin: active || isStaff,
      membershipRequired: !active && !isStaff,
      notes: active || isStaff ? cls.notes : null,
    });
    const sorted = [...eligible].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const data = { ...toItem(best), classes: sorted.map(toItem) };
    return NextResponse.json(data);
  });
}

function weekdayFlag(s: any, weekday: number): boolean {
  switch (weekday) {
    case 0:
      return s.sunday;
    case 1:
      return s.monday;
    case 2:
      return s.tuesday;
    case 3:
      return s.wednesday;
    case 4:
      return s.thursday;
    case 5:
      return s.friday;
    case 6:
      return s.saturday;
    default:
      return false;
  }
}

// referenced so forbidden import stays used in case of future guards
void forbidden;
