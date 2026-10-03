// Subscription service: bridge between the Razorpay adapter and the DB.
//
// Membership is the application-level concept; Subscription is the persisted
// provider record. "Active membership" = the user has at least one
// Subscription with status ACTIVE and an endDate in the future (or null).

import { db } from "@/lib/db";
import {
  RAZORPAY_PLAN_AMOUNT,
  RAZORPAY_PLAN_CURRENCY,
  RAZORPAY_PLAN_ID,
  razorpay,
} from "@/lib/providers/razorpay";
import { Prisma } from "@prisma/client";

export type MembershipState =
  | "NONE"
  | "PENDING" // checkout started but not yet activated
  | "ACTIVE" // subscription active and not expired
  | "EXPIRED" // past endDate
  | "HALTED" // provider paused retries
  | "CANCELLED";

export async function getMembershipState(userId: string): Promise<{
  state: MembershipState;
  subscription?: Awaited<ReturnType<typeof db.subscription.findFirst>>;
}> {
  const sub = await db.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) return { state: "NONE" };

  const now = new Date();
  if (sub.status === "CANCELLED") return { state: "CANCELLED", subscription: sub };
  if (sub.status === "HALTED") return { state: "HALTED", subscription: sub };
  if (sub.status === "ACTIVE") {
    if (sub.endDate && sub.endDate < now) return { state: "EXPIRED", subscription: sub };
    return { state: "ACTIVE", subscription: sub };
  }
  if (sub.status === "EXPIRED" || sub.status === "FAILED")
    return { state: "EXPIRED", subscription: sub };
  // CREATED / PENDING
  return { state: "PENDING", subscription: sub };
}

export async function hasActiveMembership(userId: string): Promise<boolean> {
  const { state } = await getMembershipState(userId);
  return state === "ACTIVE";
}

// Create a Razorpay subscription for the student and persist it in CREATED
// state. Returns only the data the browser needs for Checkout.
export async function createSubscriptionForUser(opts: {
  userId: string;
  userEmail: string;
  userName: string;
}) {
  // Reuse an existing CREATED subscription if one exists for this user to
  // avoid duplicate plans.
  const existing = await db.subscription.findFirst({
    where: { userId: opts.userId, status: "CREATED" },
  });
  if (existing) {
    return {
      razorpaySubscriptionId: existing.razorpaySubscriptionId,
      razorpayPlanId: existing.razorpayPlanId,
      amount: existing.amount,
      currency: existing.currency,
      shortUrl: `https://rzp.io/i/${existing.razorpaySubscriptionId.slice(-6)}`,
      status: existing.status,
    };
  }

  const created = await razorpay.createSubscription({
    userId: opts.userId,
    userEmail: opts.userEmail,
    userName: opts.userName,
  });

  await db.subscription.create({
    data: {
      userId: opts.userId,
      razorpaySubscriptionId: created.razorpaySubscriptionId,
      razorpayPlanId: created.razorpayPlanId,
      status: "CREATED",
      amount: created.amount,
      currency: created.currency,
    },
  });

  return created;
}

// Server-side verification of the Checkout result. The browser is never
// trusted; we only persist/activate after a verified Razorpay event arrives
// via webhook. This helper is used by the manual "verify" action in the dev
// harness and would be the same code path as a Checkout callback.
export async function verifyCheckout(opts: {
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ verified: boolean }> {
  const ok = razorpay.verifyPaymentSignature(
    opts.razorpaySubscriptionId,
    opts.razorpayPaymentId,
    opts.razorpaySignature
  );
  if (!ok) return { verified: false };
  // The actual state change happens in the webhook processor; here we just
  // confirm the signature so the client can show a success screen.
  return { verified: true };
}

// Map a Razorpay webhook event to local state changes, transactionally.
// Returns whether the event was actually applied (vs. ignored duplicate).
export async function applyRazorpayEvent(
  event: { event: string; payload: any },
  eventId: string
): Promise<{ applied: boolean; reason?: string }> {
  // Idempotency: WebhookEvent row keyed by (provider, eventId).
  // Create the row up-front so concurrent webhooks cannot double-process.
  try {
    await db.webhookEvent.create({
      data: {
        provider: "razorpay",
        eventId,
        eventType: event.event,
        payloadHash: JSON.stringify(event.payload).slice(0, 64),
        status: "PROCESSING",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { applied: false, reason: "duplicate_event" };
    }
    throw e;
  }

  try {
    const subEntity = event.payload?.subscription?.entity;
    const payEntity = event.payload?.payment?.entity;
    if (!subEntity?.id) {
      await db.webhookEvent.update({
        where: { provider_eventId: { provider: "razorpay", eventId } },
        data: { status: "IGNORED", processedAt: new Date() },
      });
      return { applied: false, reason: "no_subscription_in_payload" };
    }

    const subscription = await db.subscription.findUnique({
      where: { razorpaySubscriptionId: subEntity.id },
    });
    if (!subscription) {
      await db.webhookEvent.update({
        where: { provider_eventId: { provider: "razorpay", eventId } },
        data: {
          status: "FAILED",
          errorMessage: "no local subscription",
          processedAt: new Date(),
        },
      });
      return { applied: false, reason: "no_local_subscription" };
    }

    await db.$transaction(async (tx) => {
      const nextStatus = mapRazorpayStatus(event.event, subEntity.status);
      const now = new Date();
      const start = subEntity.current_start
        ? new Date(subEntity.current_start * 1000)
        : now;
      const end = subEntity.current_end
        ? new Date(subEntity.current_end * 1000)
        : null;
      const nextBilling = subEntity.charge_at
        ? new Date(subEntity.charge_at * 1000)
        : end;

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: nextStatus,
          startDate: start,
          endDate: end,
          nextBillingDate: nextBilling,
        },
      });

      if (payEntity) {
        const existingPayment = payEntity.id
          ? await tx.payment.findUnique({
              where: { razorpayPaymentId: payEntity.id },
            })
          : null;
        if (!existingPayment) {
          await tx.payment.create({
            data: {
              userId: subscription.userId,
              subscriptionId: subscription.id,
              razorpayPaymentId: payEntity.id,
              amount: payEntity.amount,
              currency: payEntity.currency,
              status: payEntity.status === "captured" ? "CAPTURED" : "PENDING",
              gatewayFee: payEntity.fee ?? 0,
              paidAt: payEntity.status === "captured" ? now : null,
            },
          });
        }
      }

      await tx.webhookEvent.update({
        where: { provider_eventId: { provider: "razorpay", eventId } },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    });

    return { applied: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.webhookEvent.update({
      where: { provider_eventId: { provider: "razorpay", eventId } },
      data: { status: "FAILED", errorMessage: msg, processedAt: new Date() },
    });
    return { applied: false, reason: msg };
  }
}

function mapRazorpayStatus(
  event: string,
  providerStatus: string
): string {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
      return "ACTIVE";
    case "subscription.halted":
      return "HALTED";
    case "subscription.cancelled":
      return "CANCELLED";
    case "subscription.expired":
      return "EXPIRED";
    case "payment.failed":
      return "FAILED";
    default:
      return providerStatus.toUpperCase();
  }
}

export const plan = {
  amount: RAZORPAY_PLAN_AMOUNT,
  currency: RAZORPAY_PLAN_CURRENCY,
  id: RAZORPAY_PLAN_ID,
};
