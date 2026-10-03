import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// List WhatsApp messages with filters. Admins can use this to verify the
// 15-minute reminder flow end-to-end.
export async function GET(req: NextRequest) {
  return run(async () => {
    await requireRole("ADMIN");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const classId = url.searchParams.get("classId") ?? undefined;
    const items = await db.whatsAppMessage.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(classId ? { classId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true, whatsappNumber: true } }, yogaClass: { select: { date: true, startTime: true, schedule: { select: { name: true } } } } },
    });
    return NextResponse.json({
      items: items.map((m) => ({
        id: m.id,
        userId: m.userId,
        classId: m.classId,
        templateName: m.templateName,
        providerMessageId: m.providerMessageId,
        status: m.status,
        sentAt: m.sentAt,
        errorCode: m.errorCode,
        errorMessage: m.errorMessage,
        createdAt: m.createdAt,
        studentName: m.user?.name,
        studentEmail: m.user?.email,
        whatsapp: m.user?.whatsappNumber,
        classDate: m.yogaClass?.date,
        classTime: m.yogaClass?.startTime,
        scheduleName: m.yogaClass?.schedule?.name,
      })),
    });
  });
}
