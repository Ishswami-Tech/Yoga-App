// One-time membership payments across Razorpay / Cashfree / PhonePe, opened through the Ishswami
// payment bridge. The browser is never trusted: an order becomes PAID only after we re-read its
// status from the gateway's own API (see settleOrder).

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { createBridgeUrl, loadBridgeConfig } from "@/lib/payments/bridge";
import { computeCoverage } from "@/lib/payments/coverage";
import { getGateways } from "@/lib/payments/gateways";
import type { GatewayName } from "@/lib/payments/types";
import { RAZORPAY_PLAN_CURRENCY, razorpay } from "@/lib/providers/razorpay";
import { getPlanAmount } from "@/lib/services/pricing";
import { createSubscriptionForUser } from "@/lib/services/subscriptions";

export type BillingType = "ONE_TIME" | "RECURRING";

export class CheckoutError extends Error {
  constructor(
    readonly code: "BRIDGE_NOT_CONFIGURED" | "GATEWAY_NOT_CONFIGURED" | "RECURRING_UNSUPPORTED",
    message: string
  ) {
    super(message);
  }
}

// A webhook and the bridge verify can settle the same order at the same moment; give the
// interactive transaction room to queue for a connection instead of failing at Prisma's 2s default.
const SETTLE_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

const PLAN_DESCRIPTION = "Yoga Membership - Monthly";

export function getCheckoutOptions(): {
  bridgeConfigured: boolean;
  gateways: GatewayName[];
  recurringAvailable: boolean;
} {
  const bridgeConfigured = loadBridgeConfig(process.env) !== null;
  const gateways = Object.keys(getGateways(process.env)) as GatewayName[];
  return {
    bridgeConfigured,
    gateways,
    recurringAvailable: bridgeConfigured && razorpay.configured,
  };
}

export async function startCheckout(opts: {
  user: { id: string; email: string; name: string; phone?: string | null };
  provider: GatewayName;
  billing: BillingType;
}): Promise<{ bridgeUrl: string }> {
  const bridge = loadBridgeConfig(process.env);
  if (!bridge) {
    throw new CheckoutError("BRIDGE_NOT_CONFIGURED", "Online payments are not configured yet");
  }

  if (opts.billing === "RECURRING") {
    if (opts.provider !== "razorpay" || !razorpay.configured) {
      throw new CheckoutError("RECURRING_UNSUPPORTED", "Recurring billing is available with Razorpay only");
    }
    const subscription = await createSubscriptionForUser({
      userId: opts.user.id,
      userEmail: opts.user.email,
      userName: opts.user.name,
    });
    return {
      bridgeUrl: createBridgeUrl(bridge, {
        provider: "razorpay",
        orderId: subscription.razorpaySubscriptionId,
        amount: subscription.amount,
        currency: subscription.currency,
        description: PLAN_DESCRIPTION,
        displayAmount: (subscription.amount / 100).toFixed(2),
        razorpayKeyId: process.env.RAZORPAY_KEY_ID?.trim(),
        razorpayMode: "subscription",
      }),
    };
  }

  const gateway = getGateways(process.env)[opts.provider];
  if (!gateway) {
    throw new CheckoutError("GATEWAY_NOT_CONFIGURED", `${opts.provider} is not configured`);
  }

  const amountPaise = await getPlanAmount();
  const localOrderId = randomUUID();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/u, "");
  const created = await gateway.createOrder({
    localOrderId,
    amountPaise,
    currency: RAZORPAY_PLAN_CURRENCY,
    description: PLAN_DESCRIPTION,
    customer: {
      id: opts.user.id,
      name: opts.user.name,
      email: opts.user.email,
      ...(opts.user.phone ? { phone: opts.user.phone } : {}),
    },
    returnUrl: `${bridge.baseUrl}/pay/callback?appId=${encodeURIComponent(bridge.appId)}&orderId=${localOrderId}&provider=${opts.provider}`,
    ...(appUrl.startsWith("https://") ? { notifyUrl: `${appUrl}/api/webhooks/${opts.provider}` } : {}),
  });

  await db.paymentOrder.create({
    data: {
      id: localOrderId,
      userId: opts.user.id,
      provider: opts.provider,
      providerOrderId: created.providerOrderId,
      amount: amountPaise,
      currency: RAZORPAY_PLAN_CURRENCY,
      status: "CREATED",
    },
  });

  return {
    bridgeUrl: createBridgeUrl(bridge, {
      provider: opts.provider,
      orderId: created.providerOrderId,
      amount: amountPaise,
      currency: RAZORPAY_PLAN_CURRENCY,
      description: PLAN_DESCRIPTION,
      displayAmount: (amountPaise / 100).toFixed(2),
      ...created.checkout,
    }),
  };
}

export interface SettleResult {
  readonly paid: boolean;
  readonly reason?: "unknown_order" | "gateway_not_configured" | "gateway_error" | "amount_mismatch" | "not_paid";
}

/**
 * Re-reads the order from the gateway and, if (and only if) the gateway reports it paid for the
 * expected amount, marks it PAID and grants coverage. Safe to call repeatedly and concurrently
 * (bridge verify, webhooks, polling): the status transition is a guarded single-row update.
 */
export async function settleOrder(providerOrderId: string, provider?: GatewayName): Promise<SettleResult> {
  const order = await db.paymentOrder.findFirst({
    where: { providerOrderId, ...(provider ? { provider } : {}) },
  });
  if (!order) {
    return { paid: false, reason: "unknown_order" };
  }
  if (order.status === "PAID") {
    return { paid: true };
  }

  const gateway = getGateways(process.env)[order.provider as GatewayName];
  if (!gateway) {
    return { paid: false, reason: "gateway_not_configured" };
  }

  let status;
  try {
    status = await gateway.fetchStatus(order.providerOrderId);
  } catch (error) {
    console.error(`[payments] ${order.provider} status check failed for order ${order.id}:`, error);
    return { paid: false, reason: "gateway_error" };
  }

  if (status.status === "FAILED") {
    await db.paymentOrder.updateMany({ where: { id: order.id, status: "CREATED" }, data: { status: "FAILED" } });
    return { paid: false, reason: "not_paid" };
  }
  if (status.status !== "PAID") {
    return { paid: false, reason: "not_paid" };
  }
  if (status.amountPaise !== undefined && status.amountPaise !== order.amount) {
    console.error(
      `[payments] amount mismatch for order ${order.id}: gateway ${status.amountPaise} vs expected ${order.amount}`
    );
    return { paid: false, reason: "amount_mismatch" };
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    // Order matters: (1) take a per-user advisory lock, (2) read the latest coversUntil, (3) claim
    // the order with the guarded update. Under READ COMMITTED, two different PAID orders for one user
    // would otherwise both read the same coversUntil and get an identical window (paid days lost).
    // The lock is transaction-scoped, so it releases on commit/rollback; the second settlement waits,
    // then its (later) read sees the first one's committed coversUntil. Settling the same order twice
    // stays idempotent because the claim in (3) still only succeeds once.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('coverage:' || ${order.userId}))`;

    const latest = await tx.paymentOrder.aggregate({
      where: { userId: order.userId, status: "PAID" },
      _max: { coversUntil: true },
    });
    const coverage = computeCoverage(now, latest._max.coversUntil);

    const claimed = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: {
        status: "PAID",
        paidAt: now,
        providerPaymentId: status.providerPaymentId ?? null,
        coversFrom: coverage.coversFrom,
        coversUntil: coverage.coversUntil,
      },
    });
    if (claimed.count === 0) {
      return; // another request already settled it
    }

    // Payment.razorpayPaymentId is the unique payment key for every gateway; non-Razorpay ids are
    // prefixed so they can never collide with a Razorpay id.
    const paymentKey =
      order.provider === "razorpay" && status.providerPaymentId
        ? status.providerPaymentId
        : `${order.provider}_${status.providerPaymentId ?? order.id}`;
    const existing = await tx.payment.findUnique({ where: { razorpayPaymentId: paymentKey } });
    if (!existing) {
      await tx.payment.create({
        data: {
          userId: order.userId,
          razorpayPaymentId: paymentKey,
          amount: order.amount,
          currency: order.currency,
          status: "CAPTURED",
          paidAt: now,
        },
      });
    }
  }, SETTLE_TX_OPTIONS);

  return { paid: true };
}
