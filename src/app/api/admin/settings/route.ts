import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fromZodError, notFound } from "@/lib/api";
import { settingsSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");
    const rows = await db.appSettings.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return NextResponse.json({
      razorpayPlanId: map.razorpayPlanId ?? "plan_yoga_monthly",
      razorpayPlanAmount: parseInt(map.razorpayPlanAmount ?? "150000", 10),
      razorpayPlanCurrency: map.razorpayPlanCurrency ?? "INR",
      whatsappTemplate: map.whatsappTemplate ?? "yoga_class_reminder_v1",
      lookAheadDays: parseInt(map.lookAheadDays ?? "2", 10),
      reminderMinutesBefore: parseInt(map.reminderMinutesBefore ?? "15", 10),
      meetLeadMinutes: parseInt(map.meetLeadMinutes ?? "90", 10),
    });
  });
}

export async function PUT(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const entries: [string, string | number | undefined][] = [
      ["razorpayPlanId", parsed.data.razorpayPlanId],
      // razorpayPlanAmount is managed via /api/admin/pricing; ignored here.
      ["razorpayPlanCurrency", parsed.data.razorpayPlanCurrency],
      ["whatsappTemplate", parsed.data.whatsappTemplate],
      ["lookAheadDays", parsed.data.lookAheadDays?.toString()],
      ["reminderMinutesBefore", parsed.data.reminderMinutesBefore?.toString()],
      ["meetLeadMinutes", parsed.data.meetLeadMinutes?.toString()],
    ];
    for (const [k, v] of entries) {
      if (v === undefined) continue;
      const existing = await db.appSettings.findUnique({ where: { key: k } });
      if (existing) {
        if (!existing) return notFound("Setting");
        await db.appSettings.update({ where: { key: k }, data: { value: String(v), updatedBy: admin.id } });
      } else {
        await db.appSettings.create({ data: { key: k, value: String(v), updatedBy: admin.id } });
      }
    }
    await audit({
      actorUserId: admin.id,
      action: "SETTINGS_UPDATE",
      entityType: "AppSettings",
      entityId: "global",
      metadata: { ...parsed.data, razorpayPlanAmount: undefined },
    });
    return NextResponse.json({ ok: true });
  });
}
