import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { applyRazorpayEvent } from "@/lib/services/subscriptions";
import { settleOrder } from "@/lib/services/payment-orders";
import { decideWebhookResponse } from "@/lib/payments/webhook-outcome";

export const runtime = "nodejs";

// Razorpay webhook signature verification: X-Razorpay-Signature must equal
// HMAC-SHA256(RAZORPAY_WEBHOOK_SECRET, raw body). The secret is mandatory in every environment
// (503 when missing). Idempotency is enforced via the WebhookEvent table, keyed by the
// X-Razorpay-Event-Id header.
function validSignature(secret: string, raw: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !validSignature(secret, raw, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const event = payload?.event;
  // Razorpay sends a unique id per event in X-Razorpay-Event-Id (stable across its retries).
  // Fall back to a hash of the raw body, which is also stable across retries.
  const eventId =
    req.headers.get("x-razorpay-event-id") ??
    payload?.event_id ??
    `body_${createHash("sha256").update(raw).digest("hex")}`;
  if (!event) {
    return NextResponse.json({ error: "no event" }, { status: 400 });
  }

  try {
    // One-time (order) payments: re-check with Razorpay and settle; no subscription is involved.
    const orderEntityId = payload?.payload?.order?.entity?.id ?? payload?.payload?.payment?.entity?.order_id;
    if (
      !payload?.payload?.subscription?.entity?.id &&
      orderEntityId &&
      (event === "order.paid" || event === "payment.captured")
    ) {
      const settled = await settleOrder(String(orderEntityId), "razorpay");
      return respond("order", settled.paid, settled.reason, event);
    }

    const res = await applyRazorpayEvent(payload, String(eventId));
    return respond("subscription", res.applied, res.reason, event);
  } catch (err) {
    // Unexpected failure (DB down, etc.): details stay in the server log, Razorpay retries.
    console.error(`[razorpay-webhook] processing threw for event ${String(event)}:`, err);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

// Transient failures answer 500 so Razorpay retries; permanent / benign outcomes answer 200.
// Response bodies are generic: reason codes and error messages stay in the server log.
function respond(kind: "order" | "subscription", applied: boolean, reason: string | undefined, event: string) {
  const decision = decideWebhookResponse({ kind, applied, reason });
  if (decision.alert) {
    // No PII: only the event type and reason code.
    console.error(`[ALERT][razorpay-webhook] permanent failure "${reason}" for event ${String(event)}`);
  } else if (decision.retry) {
    console.error(
      `[razorpay-webhook] transient failure "${reason ?? "unknown"}" for event ${String(event)}; asking Razorpay to retry`
    );
  }
  if (decision.retry) return NextResponse.json({ received: false }, { status: 500 });
  return NextResponse.json({ received: true, applied }, { status: 200 });
}
