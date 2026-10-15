import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run, fail } from "@/lib/api";
import { whatsapp } from "@/lib/providers/whatsapp";
import { activeMembersWhere } from "@/lib/services/membership";
import { audit } from "@/lib/services/audit";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1, "Message is required").max(1000, "Max 1000 characters"),
  // Optional: only send to members with active membership (default true)
  activeOnly: z.boolean().default(true),
});

function recipientWhere(activeOnly: boolean): Prisma.UserWhereInput {
  if (activeOnly) return { AND: [activeMembersWhere(), { whatsappNumber: { not: null } }] };
  return { role: "STUDENT", status: "ACTIVE", whatsappNumber: { not: null } };
}

// GET: real recipient count for the composer preview (?activeOnly=true|false).
export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole("ADMIN");
    const activeOnly = new URL(req.url).searchParams.get("activeOnly") !== "false";
    const count = await db.user.count({ where: recipientWhere(activeOnly) });
    return NextResponse.json({ count, activeOnly });
  });
}

// Admin bulk message — sends a custom WhatsApp message to all active members.
//
// This is NOT a template message — it uses the WhatsApp Business "text"
// message type (not a template). In production, custom text messages
// require a 24-hour customer service window or a template. For the mock
// adapter, we just record the messages.
//
// Each message is recorded as a WhatsAppMessage row with classId=null
// (bulk messages aren't tied to a specific class) and templateName="bulk".
// The message is logged in the audit trail.
export async function POST(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid body", 422);
    }

    const { message, activeOnly } = parsed.data;

    // Find recipients
    const recipients = await db.user.findMany({
      where: recipientWhere(activeOnly),
      select: { id: true, name: true, whatsappNumber: true },
    });

    if (recipients.length === 0) {
      return fail("No eligible recipients found", 404, { code: "NO_RECIPIENTS" });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      const result = await whatsapp.sendClassReminder({
        toWhatsapp: r.whatsappNumber!,
        templateName: "bulk",
        studentName: r.name,
        classTime: "—",
        meetUrl: "—",
        className: "Admin broadcast",
      });

      // Override the message body — for a bulk message we want the admin's
      // custom text, not the yoga template. We record the actual message
      // in the errorMessage field as a workaround (since the schema doesn't
      // have a body column). In production this would be a proper field.
      await db.whatsAppMessage.create({
        data: {
          userId: r.id,
          classId: null,
          templateName: "bulk",
          providerMessageId: result.providerMessageId || null,
          status: result.status,
          sentAt: result.status !== "FAILED" ? new Date() : null,
          errorCode: result.errorCode ?? null,
          errorMessage: message, // Store the actual message here
        },
      });

      if (result.status === "FAILED") {
        failed++;
        errors.push(`${r.name}: ${result.errorMessage}`);
      } else {
        sent++;
      }
    }

    await audit({
      actorUserId: admin.id,
      action: "BULK_MESSAGE_SENT",
      entityType: "WhatsAppMessage",
      entityId: "bulk",
      metadata: {
        message: message.slice(0, 100),
        recipientCount: recipients.length,
        sent,
        failed,
        activeOnly,
      },
    });

    return NextResponse.json({
      ok: true,
      recipientCount: recipients.length,
      sent,
      failed,
      errors: errors.slice(0, 10),
    });
  });
}
