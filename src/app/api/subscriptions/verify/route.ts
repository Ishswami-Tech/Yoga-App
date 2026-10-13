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

// Server-side verification of the Checkout result. The browser is never trusted: the signature
// is verified, then the subscription is fetched from the Razorpay API before it is marked ACTIVE.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return fail("Invalid verification payload", 422);
    return verifyCheckout({ userId: user.id, ...parsed.data });
  });
}
