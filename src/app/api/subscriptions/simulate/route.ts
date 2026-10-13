import { fail } from "@/lib/api";

export const runtime = "nodejs";

// There is no simulated checkout: payments go through Razorpay Subscriptions only.
function gone() {
  return fail("Not found", 404, { code: "NOT_FOUND" });
}

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const DELETE = gone;
