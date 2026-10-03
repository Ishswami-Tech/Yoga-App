import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound, fail } from "@/lib/api";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

// Re-open a COMPLETED class — flip the status back to READY.
//
// Use case: an instructor accidentally clicks "Complete" on a class that
// hasn't actually ended, or the class ran over and students still need the
// Meet link. Re-opening restores the join link visibility and removes the
// "ended" treatment from the dashboards.
//
// Idempotent: re-opening an already-READY class is a no-op. Re-opening a
// CANCELLED class is rejected — un-cancel by deleting the exception instead.
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
      return fail(
        "Cannot re-open a cancelled class — delete the no-class exception first.",
        409,
        { code: "CANCELLED" }
      );
    }
    if (cls.status === "READY") {
      return NextResponse.json({ ok: true, alreadyReady: true });
    }
    if (!cls.meetUrl) {
      return fail(
        "Cannot re-open a class that has no Google Meet link. Generate one first.",
        409,
        { code: "NO_MEET" }
      );
    }

    await db.yogaClass.update({
      where: { id },
      data: { status: "READY" },
    });
    await audit({
      actorUserId: actor.id,
      action: "CLASS_REOPENED",
      entityType: "YogaClass",
      entityId: id,
      metadata: {
        date: cls.date,
        scheduleName: cls.schedule?.name,
        previousStatus: cls.status,
      },
    });
    return NextResponse.json({ ok: true, status: "READY" });
  });
}
