import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership } from "@/lib/services/subscriptions";
import { run, unauthorized, forbidden, notFound } from "@/lib/api";

export const runtime = "nodejs";

// Get class notes — only visible to active members (and staff).
// This is a separate endpoint so notes aren't leaked to non-members
// via the regular classes/today response.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;

    const cls = await db.yogaClass.findUnique({
      where: { id },
      include: { schedule: { select: { name: true } } },
    });
    if (!cls) return notFound("Class");

    const active = await hasActiveMembership(user.id);
    const isStaff = user.role === "INSTRUCTOR" || user.role === "ADMIN";
    if (!active && !isStaff) return forbidden();

    return NextResponse.json({
      classId: cls.id,
      date: cls.date,
      scheduleName: cls.schedule.name,
      notes: cls.notes,
    });
  });
}
