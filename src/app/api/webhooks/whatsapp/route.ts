import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMetaHandshake, verifyMetaSignature } from "@/lib/providers/whatsapp-webhook";

export const runtime = "nodejs";

// Meta webhook verification handshake.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const result = verifyMetaHandshake(process.env.META_WA_VERIFY_TOKEN, {
    mode: p.get("hub.mode"),
    token: p.get("hub.verify_token"),
    challenge: p.get("hub.challenge"),
  });
  if (!result.ok) {
    return new NextResponse(result.status === 503 ? "not configured" : "forbidden", {
      status: result.status,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse(result.challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

// WhatsApp status callback endpoint. Meta calls this when a message
// transitions to SENT/DELIVERED/READ/FAILED. The request must carry a valid
// X-Hub-Signature-256; we then update the matching WhatsAppMessage row by
// provider message id, idempotently.
export async function POST(req: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }
  const raw = await req.text();
  if (!verifyMetaSignature(secret, raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
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
