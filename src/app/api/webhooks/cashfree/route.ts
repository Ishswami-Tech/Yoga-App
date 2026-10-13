import { NextRequest, NextResponse } from "next/server";
import { extractCashfreeOrderId, verifyCashfreeSignature } from "@/lib/payments/webhooks";
import { settleOrder } from "@/lib/services/payment-orders";

export const runtime = "nodejs";

// Cashfree webhook. The signature only authenticates the sender; the order is then re-read from
// Cashfree's API by settleOrder(), so the payload itself is never trusted for payment status.
export async function POST(req: NextRequest) {
  const secret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!secret) {
    return NextResponse.json({ error: "cashfree not configured" }, { status: 503 });
  }

  const raw = await req.text();
  const valid = verifyCashfreeSignature(
    secret,
    req.headers.get("x-webhook-timestamp"),
    raw,
    req.headers.get("x-webhook-signature"),
  );
  if (!valid) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderId = extractCashfreeOrderId(body);
  if (!orderId) {
    return NextResponse.json({ received: true, applied: false, reason: "no_order_id" });
  }
  const result = await settleOrder(orderId, "cashfree");
  return NextResponse.json({ received: true, applied: result.paid, reason: result.reason ?? null });
}
