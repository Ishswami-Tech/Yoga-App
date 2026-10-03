import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { verifyCheckout } from "@/lib/services/subscriptions";
import { run, fail } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";

const verifySchema = z.object({
  razorpaySubscriptionId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

// Server-side verification of the Checkout result. The browser is never
// trusted; this only confirms the signature so the client can show a
// success screen. The actual state change happens when the verified
// Razorpay webhook arrives.
export async function POST(req: NextRequest) {
  return run(async () => {
    await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return fail("Invalid verification payload", 422);
    return verifyCheckout(parsed.data);
  });
}
