import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fromZodError, notFound } from "@/lib/api";
import { adminUserUpdateSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

// Update a user (role/status/name/contact).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return notFound("User");
    const updated = await db.user.update({
      where: { id },
      data: {
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.email ? { email: parsed.data.email } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone ?? null } : {}),
        ...(parsed.data.whatsappNumber !== undefined ? { whatsappNumber: parsed.data.whatsappNumber ?? null } : {}),
      },
    });
    await audit({
      actorUserId: admin.id,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      metadata: parsed.data,
    });
    return NextResponse.json(updated);
  });
}

// Delete a user (admin only).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return notFound("User");
    await db.user.delete({ where: { id } });
    await audit({
      actorUserId: admin.id,
      action: "USER_DELETE",
      entityType: "User",
      entityId: id,
      metadata: { email: existing.email },
    });
    return NextResponse.json({ ok: true });
  });
}
