import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  allowedPriorStatuses,
  extractStatuses,
  verifyMetaHandshake,
  verifyMetaSignature,
} from "@/lib/providers/whatsapp-webhook";

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
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const statuses = extractStatuses(payload);
  if (statuses.length === 0) {
    return NextResponse.json({ received: true, ignored: true });
  }

  // One cheap updateMany per status; the `status in allowed priors` guard makes it forward-only and
  // idempotent (replays and out-of-order callbacks match zero rows). Never overwrites READ or FAILED.
  for (const s of statuses) {
    await db.whatsAppMessage.updateMany({
      where: { providerMessageId: s.id, status: { in: allowedPriorStatuses(s.status) } },
      data: {
        status: s.status,
        ...(s.status === "FAILED" ? { errorCode: s.errorCode, errorMessage: s.errorMessage } : {}),
        ...(s.status === "SENT" ? { sentAt: new Date() } : {}),
      },
    });
  }

  return NextResponse.json({ received: true });
}
