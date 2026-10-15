import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, revokeAllSessions } from "@/lib/auth";
import { checkAdminChange } from "@/lib/admin-guard";
import { run, fail, fromZodError, notFound } from "@/lib/api";
import { adminUserUpdateSchema } from "@/lib/validation";
import { normalizePhone, phoneCandidates, toCanonical } from "@/lib/phone";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

async function guard(
  actorId: string,
  target: { id: string; role: string; status: string },
  change: { role?: string; status?: string; delete?: boolean }
) {
  const activeAdminCount = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  const v = checkAdminChange({ actorId, target, change, activeAdminCount });
  return v ? fail(v.message, 409, { code: v.code }) : null;
}

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
    const blocked = await guard(admin.id, existing, {
      role: parsed.data.role,
      status: parsed.data.status,
    });
    if (blocked) return blocked;
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
    let updated;
    try {
      updated = await db.user.update({
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
    } catch (err) {
      if (isUniqueViolation(err, ["whatsappNumber"])) {
        return fail("This WhatsApp number already belongs to another account", 409, { code: "PHONE_TAKEN" });
      }
      throw err;
    }
    const roleChanged = parsed.data.role !== undefined && parsed.data.role !== existing.role;
    const disabled = parsed.data.status !== undefined && parsed.data.status !== "ACTIVE";
    if (roleChanged || disabled) await revokeAllSessions(id);
    await audit({
      actorUserId: admin.id,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      metadata: parsed.data,
    });
    return NextResponse.json(updated);
  }, req);
}

// Delete a user (admin only).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return notFound("User");
    const blocked = await guard(admin.id, existing, { delete: true });
    if (blocked) return blocked;
    await db.user.delete({ where: { id } });
    await revokeAllSessions(id);
    await audit({
      actorUserId: admin.id,
      action: "USER_DELETE",
      entityType: "User",
      entityId: id,
      metadata: { email: existing.email },
    });
    return NextResponse.json({ ok: true });
  }, req);
}
