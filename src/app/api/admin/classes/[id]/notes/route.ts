import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, notFound, fail } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  notes: z.string().max(2000, "Max 2000 characters").optional().nullable(),
});

// Update instructor notes for a class. Notes are visible to attendees on
// the today/upcoming views — e.g. "Bring a bolster today" or "Focus on
// hip openers". Setting notes to empty/null clears them.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const actor = await requireRole(["INSTRUCTOR", "ADMIN"]);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid", 422);

    const cls = await db.yogaClass.findUnique({ where: { id } });
    if (!cls) return notFound("Class");

    await db.yogaClass.update({
      where: { id },
      data: { notes: parsed.data.notes?.trim() || null },
    });
    await audit({
      actorUserId: actor.id,
      action: "CLASS_NOTES_UPDATED",
      entityType: "YogaClass",
      entityId: id,
      metadata: { date: cls.date, hasNotes: !!parsed.data.notes },
    });
    return NextResponse.json({ ok: true, notes: parsed.data.notes?.trim() || null });
  });
}
