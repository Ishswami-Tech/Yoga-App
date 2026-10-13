import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { run, fail } from "@/lib/api";
import { CheckoutError, getCheckoutOptions, startCheckout } from "@/lib/services/payment-orders";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  provider: z.enum(["razorpay", "cashfree", "phonepe"]),
  billing: z.enum(["ONE_TIME", "RECURRING"]),
});

// Legacy payment-bridge endpoints (one-time Cashfree / PhonePe / Razorpay orders). Disabled (404)
// unless ENABLE_PAYMENT_BRIDGE=true. The product pays through Razorpay Subscriptions only
// (/api/subscriptions/create); no UI references these routes.
function bridgeDisabled() {
  return process.env.ENABLE_PAYMENT_BRIDGE !== "true";
}

export async function GET() {
  return run(async () => {
    if (bridgeDisabled()) return fail("Not found", 404, { code: "NOT_FOUND" });
    await requireAuth();
    return getCheckoutOptions();
  });
}

// Creates the gateway order (or Razorpay subscription) and returns the signed bridge URL to send
// the browser to. Membership is only granted later, after server-side verification.
export async function POST(req: NextRequest) {
  return run(async () => {
    if (bridgeDisabled()) return fail("Not found", 404, { code: "NOT_FOUND" });
    const user = await requireAuth();
    if (user.role !== "STUDENT") {
      return fail("Only students can subscribe", 403, { code: "FORBIDDEN" });
    }
    const parsed = checkoutSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("Invalid checkout request", 422, { code: "VALIDATION" });
    }

    const profile = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } });
    try {
      return await startCheckout({
        user: { id: user.id, email: user.email, name: user.name, phone: profile?.phone },
        provider: parsed.data.provider,
        billing: parsed.data.billing,
      });
    } catch (error) {
      if (error instanceof CheckoutError) {
        return fail(error.message, 409, { code: error.code });
      }
      throw error;
    }
  });
}
