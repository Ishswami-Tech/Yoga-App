// Razorpay Subscriptions adapter (live API only).
//
// Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. There is no simulation: when the keys are
// missing every call throws PaymentsUnavailableError, which API routes turn into a 503.
// One-time payments on any gateway live in src/lib/payments/.
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

export class PaymentsUnavailableError extends Error {
  constructor() {
    super("Payments are temporarily unavailable");
    this.name = "PaymentsUnavailableError";
  }
}

// Default price; the live price is set by a super admin (see src/lib/services/pricing.ts).
export const RAZORPAY_PLAN_AMOUNT = 150000; // ₹1,500 in paise
export const RAZORPAY_PLAN_CURRENCY = "INR";
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
  /** Price in paise. Defaults to RAZORPAY_PLAN_AMOUNT. */
  amount?: number;
};

export type CreatedSubscription = {
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  amount: number;
  currency: string;
  shortUrl: string;
  status: string;
};

const API_BASE = "https://api.razorpay.com/v1";
const SUBSCRIPTION_TOTAL_COUNT = 120; // 10 years of monthly billing; the student can cancel any time.

type Credentials = { keyId: string; keySecret: string };

function liveCredentials(): Credentials | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return keyId && keySecret ? { keyId, keySecret } : null;
}

function requireCredentials(): Credentials {
  const c = liveCredentials();
  if (!c) throw new PaymentsUnavailableError();
  return c;
}

export function isRazorpayConfigured(): boolean {
  return liveCredentials() !== null;
}

/** Public key id for Checkout (never the secret). */
export function getPublicKeyId(): string {
  return requireCredentials().keyId;
}

export type RazorpaySubscriptionEntity = {
  id: string;
  plan_id?: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  paid_count?: number;
  remaining_count?: number;
  notes?: Record<string, string> | unknown[];
};

async function rzpRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const credentials = requireCredentials();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: authHeader(credentials) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { description?: string } })
    | null;
  if (!response.ok || !data) {
    throw new Error(`Razorpay request failed: ${data?.error?.description ?? response.status}`);
  }
  return data;
}

function authHeader(credentials: Credentials): string {
  return `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64")}`;
}

// Razorpay plan amounts cannot be edited, so each price gets its own plan. The plan id for a price is
// created once through the API and remembered in AppSettings.
async function ensureLivePlan(
  amount: number,
  credentials: Credentials
): Promise<string> {
  const key = `razorpayLivePlan_${amount}`;
  const cached = await db.appSettings.findUnique({ where: { key } });
  if (cached?.value) return cached.value;
  const response = await fetch(`${API_BASE}/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader(credentials) },
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: { name: RAZORPAY_PLAN_NAME, amount, currency: RAZORPAY_PLAN_CURRENCY },
    }),
  });
  const data = (await response.json().catch(() => null)) as { id?: string; error?: { description?: string } } | null;
  if (!response.ok || !data?.id) {
    throw new Error(`Razorpay plan creation failed: ${data?.error?.description ?? response.status}`);
  }
  await db.appSettings.upsert({ where: { key }, update: { value: data.id }, create: { key, value: data.id } });
  return data.id;
}

async function createLiveSubscription(
  input: CreateSubscriptionInput,
  credentials: Credentials
): Promise<CreatedSubscription> {
  const amount = input.amount ?? RAZORPAY_PLAN_AMOUNT;
  const planId = await ensureLivePlan(amount, credentials);
  const response = await fetch(`${API_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(credentials),
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: SUBSCRIPTION_TOTAL_COUNT,
      customer_notify: 1,
      notes: { userId: input.userId, email: input.userEmail },
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    id?: string;
    status?: string;
    short_url?: string;
    error?: { description?: string };
  } | null;
  if (!response.ok || !data?.id) {
    throw new Error(`Razorpay subscription creation failed: ${data?.error?.description ?? response.status}`);
  }
  return {
    razorpaySubscriptionId: data.id,
    razorpayPlanId: planId,
    amount,
    currency: RAZORPAY_PLAN_CURRENCY,
    shortUrl: data.short_url ?? "",
    status: (data.status ?? "created").toUpperCase(),
  };
}

export const razorpay = {
  get configured(): boolean {
    return isRazorpayConfigured();
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    return createLiveSubscription(input, requireCredentials());
  },

  async fetchSubscription(subscriptionId: string): Promise<RazorpaySubscriptionEntity> {
    return rzpRequest<RazorpaySubscriptionEntity>("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  },

  async cancelSubscription(subscriptionId: string, atCycleEnd: boolean): Promise<RazorpaySubscriptionEntity> {
    return rzpRequest<RazorpaySubscriptionEntity>(
      "POST",
      `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      { cancel_at_cycle_end: atCycleEnd ? 1 : 0 }
    );
  },

  async pauseSubscription(subscriptionId: string): Promise<RazorpaySubscriptionEntity> {
    return rzpRequest<RazorpaySubscriptionEntity>(
      "POST",
      `/subscriptions/${encodeURIComponent(subscriptionId)}/pause`,
      { pause_at: "now" }
    );
  },

  async resumeSubscription(subscriptionId: string): Promise<RazorpaySubscriptionEntity> {
    return rzpRequest<RazorpaySubscriptionEntity>(
      "POST",
      `/subscriptions/${encodeURIComponent(subscriptionId)}/resume`,
      { resume_at: "now" }
    );
  },

  // Razorpay signs `${payment_id}|${subscription_id}` with the key secret (HMAC-SHA256, hex).
  verifyPaymentSignature(subscriptionId: string, paymentId: string, signature: string): boolean {
    return verifyPaymentSignatureWithSecret(requireCredentials().keySecret, subscriptionId, paymentId, signature);
  },
};

/** Pure helper (unit-testable): constant-time check of a Checkout signature. */
export function verifyPaymentSignatureWithSecret(
  keySecret: string,
  subscriptionId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(
    createHmac("sha256", keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex")
  );
  const provided = Buffer.from(signature);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
