import { NextRequest, NextResponse } from "next/server";
import { extractPhonePeOrderId, verifyPhonePeAuthorization } from "@/lib/payments/webhooks";
import { settleOrder } from "@/lib/services/payment-orders";

export const runtime = "nodejs";

// PhonePe webhook. Authenticated with the username/password configured on the PhonePe dashboard;
// the order is then re-read from PhonePe's API by settleOrder(), never trusted from the payload.
export async function POST(req: NextRequest) {
  const username = process.env.PHONEPE_WEBHOOK_USERNAME?.trim() ?? "";
  const password = process.env.PHONEPE_WEBHOOK_PASSWORD?.trim() ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "phonepe webhook not configured" }, { status: 503 });
  }

  if (!verifyPhonePeAuthorization(username, password, req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const orderId = extractPhonePeOrderId(body);
  if (!orderId) {
    return NextResponse.json({ received: true, applied: false, reason: "no_order_id" });
  }
  const result = await settleOrder(orderId, "phonepe");
  return NextResponse.json({ received: true, applied: result.paid, reason: result.reason ?? null });
}
