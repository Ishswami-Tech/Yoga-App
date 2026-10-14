import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership } from "@/lib/services/subscriptions";
import { istDateString, addDays, istDateTime } from "@/lib/services/scheduling";
import { meetAvailableAt } from "@/lib/services/meet-window";
import { getMeetLeadMinutes } from "@/lib/services/class-generator";
import { run, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

// Upcoming authorized classes for the next `days` days (default 7). Active
// membership required to receive the meetUrl for each class.
export async function GET(req: Request) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const url = new URL(req.url);
    const days = Math.min(
      Math.max(parseInt(url.searchParams.get("days") ?? "7", 10) || 7, 1),
      30
    );

    const active = await hasActiveMembership(user.id);
    const isStaff = user.role === "INSTRUCTOR" || user.role === "ADMIN";

    const todayStr = istDateString(new Date());
    const endStr = istDateString(addDays(new Date(), days));

    const classes = await db.yogaClass.findMany({
      where: {
        date: { gte: todayStr, lte: endStr },
        status: { in: ["READY", "PENDING_MEET"] },
      },
      include: { schedule: true },
      orderBy: { date: "asc" },
    });

    const leadMinutes = await getMeetLeadMinutes();
    const data = classes.map((c) => ({
      id: c.id,
      date: c.date,
      startTime: c.startTime,
      endTime: c.endTime,
      status: c.status,
      scheduleName: c.schedule.name,
      hasMeet: Boolean(c.meetUrl),
      meetAvailableAt: meetAvailableAt(istDateTime(c.date, c.startTime), leadMinutes).toISOString(),
      meetUrl: active || isStaff ? c.meetUrl : null,
      reminderSent: Boolean(c.reminderSentAt),
      canJoin: active || isStaff,
    }));

    return NextResponse.json({ days, items: data });
  });
}
