import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fromZodError } from "@/lib/api";
import { scheduleSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

export async function GET() {
  return run(async () => {
    await requireRole(["ADMIN", "INSTRUCTOR"]);
    const schedules = await db.classSchedule.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { classes: true, exceptions: true } } },
    });
    return NextResponse.json({ items: schedules });
  });
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const s = await db.classSchedule.create({ data: parsed.data });
    await audit({
      actorUserId: admin.id,
      action: "SCHEDULE_CREATE",
      entityType: "ClassSchedule",
      entityId: s.id,
      metadata: parsed.data,
    });
    return NextResponse.json(s, { status: 201 });
  });
}
