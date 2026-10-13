import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadBridgeConfig, verifyBridgeRequest } from "@/lib/payments/bridge";
import { isGatewayName } from "@/lib/payments/gateways";
import { razorpay } from "@/lib/providers/razorpay";
import { settleOrder } from "@/lib/services/payment-orders";

export const runtime = "nodejs";

const verifySchema = z.object({
  appId: z.string().min(1),
  orderId: z.string().min(1).max(128),
  paymentId: z.string().max(128).optional(),
  provider: z.string().max(32).optional(),
  razorpaySignature: z.string().max(256).optional(),
  mode: z.enum(["order", "subscription"]).optional(),
});

// Called server-to-server by the Ishswami payment bridge after the student returns from a gateway.
// Authenticated with an HMAC over `${timestamp}.${rawBody}`; replies `{ success: true }` only when
// this app has itself confirmed the payment.
export async function POST(req: NextRequest) {
  const config = loadBridgeConfig(process.env);
  if (!config) {
    return NextResponse.json({ error: "bridge not configured" }, { status: 503 });
  }

  const raw = await req.text();
  const authentic = verifyBridgeRequest(
    config,
    {
      timestamp: req.headers.get("x-bridge-timestamp"),
      signature: req.headers.get("x-bridge-signature"),
    },
    raw,
  );
  if (!authentic) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof verifySchema>;
  try {
    body = verifySchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (body.appId !== config.appId) {
    return NextResponse.json({ error: "wrong app" }, { status: 400 });
  }

  if (body.mode === "subscription") {
    // Activation itself comes from Razorpay's verified webhook; here we only confirm the
    // checkout signature so the student sees a success screen while activation lands.
    if (!body.paymentId || !body.razorpaySignature) {
      return NextResponse.json({ success: false });
    }
    const local = await db.subscription.findUnique({ where: { razorpaySubscriptionId: body.orderId } });
    const valid = Boolean(local) && razorpay.configured && razorpay.verifyPaymentSignature(body.orderId, body.paymentId, body.razorpaySignature);
    return NextResponse.json({ success: valid });
  }

  const provider = isGatewayName(body.provider) ? body.provider : undefined;
  const result = await settleOrder(body.orderId, provider);
  return NextResponse.json({ success: result.paid });
}
