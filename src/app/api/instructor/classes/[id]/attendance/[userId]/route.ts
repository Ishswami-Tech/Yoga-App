import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound } from "@/lib/api";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

// DELETE: remove a single student's attendance record for a class.
//
// Used by the per-student attendance picker when an instructor toggles a
// student off (e.g. they joined late, marked by mistake). Idempotent —
// deleting a non-existent record is a no-op.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; userId: string }> }) {
  return run(async () => {
    const actor = await requireRole(["INSTRUCTOR", "ADMIN"]);
    const { id: classId, userId } = await ctx.params;
    const cls = await db.yogaClass.findUnique({
      where: { id: classId },
      include: { schedule: true },
    });
    if (!cls) return notFound("Class");

    await db.attendance.deleteMany({
      where: { userId, classId },
    });
    await audit({
      actorUserId: actor.id,
      action: "ATTENDANCE_REMOVED",
      entityType: "YogaClass",
      entityId: classId,
      metadata: {
        date: cls.date,
        scheduleName: cls.schedule?.name,
        userId,
      },
    });
    return NextResponse.json({ ok: true });
  });
}
