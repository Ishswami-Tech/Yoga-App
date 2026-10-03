import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";
import { istDateString, addDays } from "@/lib/services/scheduling";

export const runtime = "nodejs";

// List generated classes with filters.
export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole(["ADMIN", "INSTRUCTOR"]);
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const scheduleId = url.searchParams.get("scheduleId") ?? undefined;
    const days = parseInt(url.searchParams.get("days") ?? "14", 10) || 14;
    const from = istDateString(new Date());
    const to = istDateString(addDays(new Date(), days));

    const classes = await db.yogaClass.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(status ? { status } : {}),
        ...(scheduleId ? { scheduleId } : {}),
      },
      include: { schedule: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 200,
    });

    return NextResponse.json({
      items: classes.map((c) => ({
        id: c.id,
        date: c.date,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        scheduleName: c.schedule.name,
        googleEventId: c.googleEventId,
        meetUrl: c.meetUrl,
        reminderAt: c.reminderAt,
        reminderSentAt: c.reminderSentAt,
      })),
    });
  });
}
