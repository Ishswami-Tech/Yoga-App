import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fromZodError, notFound, fail } from "@/lib/api";
import { resyncFutureClasses } from "@/lib/services/class-sync";
import { getReminderMinutesBefore } from "@/lib/services/class-generator";
import { istDateString } from "@/lib/services/scheduling";
import { scheduleSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const existing = await db.classSchedule.findUnique({ where: { id } });
    if (!existing) return notFound("Schedule");
    const updated = await db.classSchedule.update({ where: { id }, data: parsed.data });
    if (existing.startTime !== updated.startTime || existing.endTime !== updated.endTime) {
      await resyncFutureClasses(id, updated.startTime, updated.endTime, await getReminderMinutesBefore());
    }
    await audit({
      actorUserId: admin.id,
      action: "SCHEDULE_UPDATE",
      entityType: "ClassSchedule",
      entityId: id,
      metadata: parsed.data,
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const existing = await db.classSchedule.findUnique({ where: { id } });
    if (!existing) return notFound("Schedule");
    const today = istDateString(new Date());
    const [history, past] = await Promise.all([
      db.yogaClass.count({
        where: { scheduleId: id, OR: [{ attendances: { some: {} } }, { feedbacks: { some: {} } }] },
      }),
      db.yogaClass.count({ where: { scheduleId: id, date: { lt: today } } }),
    ]);
    if (history > 0 || past > 0) {
      return fail("This schedule has classes with history; deactivate it instead", 409, {
        code: "SCHEDULE_HAS_HISTORY",
      });
    }
    await db.classSchedule.delete({ where: { id } });
    await audit({
      actorUserId: admin.id,
      action: "SCHEDULE_DELETE",
      entityType: "ClassSchedule",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  });
}
