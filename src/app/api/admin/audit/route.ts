import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole("ADMIN");
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const items = await db.auditLog.findMany({
      where: { ...(entityType ? { entityType } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { name: true, email: true } } },
    });
    return NextResponse.json({
      items: items.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        actorName: a.actor?.name,
        actorEmail: a.actor?.email,
        createdAt: a.createdAt,
      })),
    });
  });
}
