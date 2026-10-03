import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Optional WhatsApp status callback endpoint. Meta calls this when a message
// transitions to SENT/DELIVERED/READ/FAILED. We update the matching
// WhatsAppMessage row by provider message id, idempotently.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const entry = payload?.entry?.[0]?.changes?.[0]?.value;
  const status = entry?.statuses?.[0];
  if (!status?.id) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const map: Record<string, string> = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  };
  const mapped = map[status.status] ?? "SENT";

  await db.whatsAppMessage.updateMany({
    where: { providerMessageId: status.id },
    data: {
      status: mapped,
      errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : null,
      errorMessage: status.errors?.[0]?.title ?? null,
      sentAt: mapped !== "FAILED" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ received: true });
}
