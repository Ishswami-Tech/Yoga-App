// Razorpay adapter.
//
// In production this module would call the real Razorpay REST API using
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. In this sandbox environment we
// simulate the lifecycle deterministically so the rest of the platform
// (subscriptions, payments, webhooks, access control) can be exercised
// end-to-end without real credentials.
//
// The public method signatures mirror the real Razorpay Subscription API so
// the adapter can be swapped for the live implementation later.

export const RAZORPAY_PLAN_AMOUNT = 50000; // ₹500 in paise
export const RAZORPAY_PLAN_CURRENCY = "INR";
export const RAZORPAY_PLAN_ID = "plan_yoga_monthly_500";
export const RAZORPAY_PLAN_NAME = "Yoga Membership - Monthly";

export type RazorpaySubscriptionStatus =
  | "CREATED"
  | "ACTIVE"
  | "PENDING"
  | "HALTED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

export type CreateSubscriptionInput = {
  userId: string;
  userEmail: string;
  userName: string;
};

export type CreatedSubscription = {
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  amount: number;
  currency: string;
  shortUrl: string;
  status: string;
};

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}

// In-memory map of subscription -> simulated state. Persisted via DB but
// the adapter itself is stateless; this just tracks the simulated checkout.
const simulatedCheckouts = new Map<
  string,
  { subscriptionId: string; userId: string; authorized: boolean }
>();

export const razorpay = {
  isMock: true,

  async createSubscription(
    input: CreateSubscriptionInput
  ): Promise<CreatedSubscription> {
    const subscriptionId = id("sub");
    simulatedCheckouts.set(subscriptionId, {
      subscriptionId,
      userId: input.userId,
      authorized: false,
    });
    return {
      razorpaySubscriptionId: subscriptionId,
      razorpayPlanId: RAZORPAY_PLAN_ID,
      amount: RAZORPAY_PLAN_AMOUNT,
      currency: RAZORPAY_PLAN_CURRENCY,
      shortUrl: `https://rzp.io/i/${subscriptionId.slice(-6)}`,
      status: "CREATED",
    };
  },

  // Simulate the customer authorising the subscription in Checkout. In real
  // life this is done by the customer on the Razorpay hosted page; we expose
  // a helper so an admin/test can drive the lifecycle.
  async authorizeSubscription(subscriptionId: string): Promise<{
    authorized: boolean;
    paymentId: string;
    signature: string;
  }> {
    const entry = simulatedCheckouts.get(subscriptionId);
    if (!entry) {
      throw new Error("Unknown subscription / no checkout initiated");
    }
    entry.authorized = true;
    const paymentId = id("pay");
    const signature = id("sig");
    return { authorized: true, paymentId, signature };
  },

  // Verify the signature returned from Checkout. In the mock adapter we
  // accept any signature produced by authorizeSubscription() and reject
  // everything else.
  verifyPaymentSignature(
    _subscriptionId: string,
    _paymentId: string,
    signature: string
  ): boolean {
    return signature.startsWith("sig_");
  },

  // Produce the synthetic webhook payloads the platform expects to receive
  // after a checkout. Used by the test harness and by the admin "simulate
  // payment" action.
  buildAuthorizedEvent(subscriptionId: string, paymentId: string) {
    return {
      event: "subscription.activated",
      payload: {
        subscription: {
          entity: {
            id: subscriptionId,
            status: "active" as RazorpaySubscriptionStatus,
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
            charge_at: Math.floor(Date.now() / 1000) + 30 * 86400,
            amount: RAZORPAY_PLAN_AMOUNT,
            currency: RAZORPAY_PLAN_CURRENCY,
            plan_id: RAZORPAY_PLAN_ID,
          },
        },
        payment: {
          entity: {
            id: paymentId,
            amount: RAZORPAY_PLAN_AMOUNT,
            currency: RAZORPAY_PLAN_CURRENCY,
            status: "captured",
            method: "upi",
            fee: 1180, // ~₹11.80 gateway fee (mock)
            tax: 0,
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };
  },

  buildChargedEvent(subscriptionId: string, cycle: number) {
    const paymentId = id("pay");
    return {
      event: "subscription.charged",
      payload: {
        subscription: {
          entity: {
            id: subscriptionId,
            status: "active",
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
            charge_at: Math.floor(Date.now() / 1000) + 30 * 86400,
          },
        },
        payment: {
          entity: {
            id: paymentId,
            amount: RAZORPAY_PLAN_AMOUNT,
            currency: RAZORPAY_PLAN_CURRENCY,
            status: "captured",
            fee: 1180,
            tax: 0,
            created_at: Math.floor(Date.now() / 1000),
            notes: { cycle: String(cycle) },
          },
        },
      },
    };
  },

  buildHaltedEvent(subscriptionId: string) {
    return {
      event: "subscription.halted",
      payload: {
        subscription: {
          entity: { id: subscriptionId, status: "halted" },
        },
      },
    };
  },

  buildCancelledEvent(subscriptionId: string) {
    return {
      event: "subscription.cancelled",
      payload: {
        subscription: {
          entity: {
            id: subscriptionId,
            status: "cancelled",
            cancelled_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };
  },
};
