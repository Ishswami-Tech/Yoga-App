import { NextResponse } from "next/server";
import { run } from "@/lib/api";
import { getPlanAmount, formatRupees } from "@/lib/services/pricing";
import { RAZORPAY_PLAN_CURRENCY, RAZORPAY_PLAN_NAME } from "@/lib/providers/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: the current membership price, so the landing page, checkout and student app never hard-code it.
export async function GET() {
  return run(async () => {
    const amountPaise = await getPlanAmount();
    return NextResponse.json({
      amountPaise,
      currency: RAZORPAY_PLAN_CURRENCY,
      name: RAZORPAY_PLAN_NAME,
      display: formatRupees(amountPaise),
    });
  });
}
