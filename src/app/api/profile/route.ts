import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import { run, fromZodError, fail } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

// Get current user's profile.
export async function GET() {
  return run(async () => {
    const user = await requireAuth();
    const u = await db.user.findUnique({ where: { id: user.id } });
    return NextResponse.json({
      id: u?.id,
      email: u?.email,
      name: u?.name,
      phone: u?.phone,
      whatsappNumber: u?.whatsappNumber,
      role: u?.role,
      createdAt: u?.createdAt,
    });
  });
}

// Update current user's profile (name, phone, whatsapp number only).
export async function PATCH(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const data = parsed.data;
    // The WhatsApp login number is never editable here (it is the sign-in identity; admins change
    // it). `phone` is only touched when the client actually sent it, and is normalised.
    let phone: string | null | undefined;
    if (data.phone !== undefined) {
      phone = data.phone ? normalizePhone(data.phone) : null;
      if (data.phone && !phone) return fail("Enter a valid phone number", 422, { code: "INVALID_PHONE" });
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: data.name, ...(phone !== undefined ? { phone } : {}) },
    });
    await audit({
      actorUserId: user.id,
      action: "PROFILE_UPDATE",
      entityType: "User",
      entityId: user.id,
    });
    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      phone: updated.phone,
      whatsappNumber: updated.whatsappNumber,
      role: updated.role,
    });
  });
}
