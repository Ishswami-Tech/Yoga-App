import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound, fail } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { istDateString } from "@/lib/services/scheduling";

export const runtime = "nodejs";

// Mark a generated YogaClass as COMPLETED.
//
// Per the spec: "After class: class remains in history; no video processing
// is performed by the platform." Instructors/admins can flip the status to
// COMPLETED once the live session ends so the dashboard shows a clean
// today/history split and the WhatsApp logs are easy to scan.
//
// Idempotent: marking an already-completed class is a no-op.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const actor = await requireRole(["INSTRUCTOR", "ADMIN"]);
    const { id } = await ctx.params;
    const cls = await db.yogaClass.findUnique({
      where: { id },
      include: { schedule: true },
    });
    if (!cls) return notFound("Class");

    if (cls.status === "CANCELLED") {
      return fail("Cannot complete a cancelled class", 409, {
        code: "CANCELLED",
      });
    }
    if (cls.status === "COMPLETED") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    await db.yogaClass.update({
      where: { id },
      data: { status: "COMPLETED" },
    });
    await audit({
      actorUserId: actor.id,
      action: "CLASS_COMPLETED",
      entityType: "YogaClass",
      entityId: id,
      metadata: {
        date: cls.date,
        scheduleName: cls.schedule?.name,
        today: istDateString(new Date()),
      },
    });
    return NextResponse.json({ ok: true, status: "COMPLETED" });
  });
}
