import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fail, fromZodError, notFound } from "@/lib/api";
import { adminUserUpdateSchema } from "@/lib/validation";
import { normalizePhone, phoneCandidates, toCanonical } from "@/lib/phone";
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
    let waCanonical: string | null | undefined;
    if (parsed.data.whatsappNumber !== undefined) {
      if (parsed.data.whatsappNumber === null || parsed.data.whatsappNumber.trim() === "") {
        waCanonical = null;
      } else {
        const wa = normalizePhone(parsed.data.whatsappNumber);
        if (!wa) return fail("Enter a valid WhatsApp number", 422, { code: "INVALID_PHONE" });
        const taken = await db.user.findFirst({
          where: { whatsappNumber: { in: phoneCandidates(wa) }, id: { not: id } },
          select: { id: true },
        });
        if (taken) return fail("This WhatsApp number already belongs to another account", 409, { code: "PHONE_TAKEN" });
        waCanonical = toCanonical(wa);
      }
    }
    const updated = await db.user.update({
      where: { id },
      data: {
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.email ? { email: parsed.data.email } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone ?? null } : {}),
        ...(waCanonical !== undefined ? { whatsappNumber: waCanonical } : {}),
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
