import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";
import { istDateString } from "@/lib/services/scheduling";

export const runtime = "nodejs";

// Instructor view: today's class + history.
export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole(["INSTRUCTOR", "ADMIN"]);
    const url = new URL(req.url);
    const today = istDateString(new Date());
    const todayClasses = await db.yogaClass.findMany({
      where: { date: today },
      include: { schedule: true },
    });
    const history = await db.yogaClass.findMany({
      where: { date: { lt: today } },
      include: { schedule: true },
      orderBy: { date: "desc" },
      take: 30,
    });
    const upcoming = await db.yogaClass.findMany({
      where: { date: { gt: today } },
      include: { schedule: true },
      orderBy: { date: "asc" },
      take: 30,
    });
    return NextResponse.json({
      today: todayClasses.map((c) => ({
        id: c.id,
        date: c.date,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        scheduleName: c.schedule.name,
        meetUrl: c.meetUrl,
        reminderSentAt: c.reminderSentAt,
      })),
      upcoming: upcoming.map((c) => ({
        id: c.id,
        date: c.date,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        scheduleName: c.schedule.name,
        meetUrl: c.meetUrl,
      })),
      history: history.map((c) => ({
        id: c.id,
        date: c.date,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        scheduleName: c.schedule.name,
        meetUrl: c.meetUrl,
      })),
    });
  });
}
