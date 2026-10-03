import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fromZodError } from "@/lib/api";
import { exceptionSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole(["ADMIN", "INSTRUCTOR"]);
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId") ?? undefined;
    const exceptions = await db.classException.findMany({
      where: { ...(scheduleId ? { scheduleId } : {}) },
      orderBy: { date: "asc" },
      include: { schedule: { select: { name: true } } },
    });
    return NextResponse.json({ items: exceptions });
  });
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const parsed = exceptionSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const created = await db.classException.upsert({
      where: {
        scheduleId_date: {
          scheduleId: parsed.data.scheduleId,
          date: parsed.data.date,
        },
      },
      update: { type: parsed.data.type, reason: parsed.data.reason ?? null },
      create: {
        scheduleId: parsed.data.scheduleId,
        date: parsed.data.date,
        type: parsed.data.type,
        reason: parsed.data.reason ?? null,
      },
    });
    // If NO_CLASS, cancel any already-generated class for that date.
    if (parsed.data.type === "NO_CLASS") {
      await db.yogaClass.updateMany({
        where: { scheduleId: parsed.data.scheduleId, date: parsed.data.date },
        data: { status: "CANCELLED" },
      });
    }
    await audit({
      actorUserId: admin.id,
      action: "EXCEPTION_CREATE",
      entityType: "ClassException",
      entityId: created.id,
      metadata: parsed.data,
    });
    return NextResponse.json(created, { status: 201 });
  });
}
