import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fromZodError, notFound } from "@/lib/api";
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
