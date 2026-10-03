import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership } from "@/lib/services/subscriptions";
import { istDateString, istWeekday } from "@/lib/services/scheduling";
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
    const eligible = [];
    for (const cls of classes) {
      const s = cls.schedule;
      if (!s.active) continue;
      const flag = weekdayFlag(s, weekday);
      if (!flag) continue;
      const exception = await db.classException.findUnique({
        where: { scheduleId_date: { scheduleId: s.id, date: todayStr } },
      });
      if (exception?.type === "NO_CLASS") continue;
      eligible.push(cls);
    }

    if (eligible.length === 0) return notFound("Today's class");

    const cls = eligible[0];
    const active = await hasActiveMembership(user.id);
    const isStaff = user.role === "INSTRUCTOR" || user.role === "ADMIN";

    const data: any = {
      id: cls.id,
      date: cls.date,
      startTime: cls.startTime,
      endTime: cls.endTime,
      status: cls.status,
      scheduleName: cls.schedule.name,
      hasMeet: Boolean(cls.meetUrl),
      meetUrl: active || isStaff ? cls.meetUrl : null,
      reminderSent: Boolean(cls.reminderSentAt),
      canJoin: active || isStaff,
      membershipRequired: !active && !isStaff,
      notes: active || isStaff ? cls.notes : null,
    };
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
