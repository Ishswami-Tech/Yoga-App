import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound } from "@/lib/api";
import { restoreCancelledOn } from "@/lib/services/class-sync";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const existing = await db.classException.findUnique({ where: { id } });
    if (!existing) return notFound("Exception");
    await db.classException.delete({ where: { id } });
    if (existing.type === "NO_CLASS") {
      await restoreCancelledOn(existing.scheduleId, existing.date);
    }
    await audit({
      actorUserId: admin.id,
      action: "EXCEPTION_DELETE",
      entityType: "ClassException",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  });
}
