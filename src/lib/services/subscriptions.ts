// Subscription service: bridge between the Razorpay adapter and the DB.
//
// Membership is the application-level concept; Subscription is the persisted
// provider record. "Active membership" = the user has at least one
// Subscription that is entitled per lib/services/membership.ts (ACTIVE within a 24h grace after
// endDate, or CANCELLED with paid time left), or a PAID one-time order still covering today.

import { getPlanAmount } from "@/lib/services/pricing";
import { db } from "@/lib/db";
import {
  RAZORPAY_PLAN_AMOUNT,
  RAZORPAY_PLAN_CURRENCY,
  getPublicKeyId,
  razorpay,
  type RazorpaySubscriptionEntity,
} from "@/lib/providers/razorpay";
import { deriveSubscriptionState, selectBestSubscription } from "@/lib/services/membership";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

export class SubscriptionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

export type MembershipState =
  | "NONE"
  | "PENDING" // checkout started but not yet activated
  | "ACTIVE" // subscription active and not expired
  | "EXPIRED" // past endDate
  | "HALTED" // provider paused retries
  | "CANCELLED";

type SubscriptionRow = Awaited<ReturnType<typeof db.subscription.findFirst>>;
type PaymentOrderRow = Awaited<ReturnType<typeof db.paymentOrder.findFirst>>;

// Membership state with one-time payments considered: a PAID PaymentOrder whose coverage has not
// ended keeps the membership ACTIVE even when there is no (active) Razorpay subscription.
export async function getMembershipState(userId: string): Promise<{
  state: MembershipState;
  subscription?: SubscriptionRow;
  order?: PaymentOrderRow;
}> {
  const fromSubscription = await getSubscriptionState(userId);
  if (fromSubscription.state === "ACTIVE") return fromSubscription;

  const order = await db.paymentOrder.findFirst({
    where: { userId, status: "PAID", coversUntil: { gte: new Date() } },
    orderBy: { coversUntil: "desc" },
  });
  if (order) return { state: "ACTIVE", order };
  return fromSubscription;
}

export type MembershipSummary = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  nextBillingDate: Date | null;
  /** Razorpay subscription id, or the gateway order id for one-time payments. */
  razorpaySubscriptionId: string;
  billing: "RECURRING" | "ONE_TIME";
};

// One shape for the UI whether access comes from a subscription or a one-time order.
export function summarizeMembership(m: {
  subscription?: SubscriptionRow;
  order?: PaymentOrderRow;
}): MembershipSummary | null {
  if (m.subscription) {
    const sub = m.subscription;
    return {
      id: sub.id,
      status: sub.status,
      amount: sub.amount,
      currency: sub.currency,
      startDate: sub.startDate,
      endDate: sub.endDate,
      nextBillingDate: sub.nextBillingDate,
      razorpaySubscriptionId: sub.razorpaySubscriptionId,
      billing: "RECURRING",
    };
  }
  if (m.order) {
    const order = m.order;
    return {
      id: order.id,
      status: "ACTIVE",
      amount: order.amount,
      currency: order.currency,
      startDate: order.coversFrom,
      endDate: order.coversUntil,
      nextBillingDate: null,
      razorpaySubscriptionId: order.providerOrderId,
      billing: "ONE_TIME",
    };
  }
  return null;
}

async function getSubscriptionState(userId: string): Promise<{
  state: MembershipState;
  subscription?: SubscriptionRow;
}> {
  const rows = await db.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  const now = new Date();
  const sub = selectBestSubscription(rows, now);
  if (!sub) return { state: "NONE" };
  return { state: deriveSubscriptionState(sub, now), subscription: sub };
}

export async function hasActiveMembership(userId: string): Promise<boolean> {
  const { state } = await getMembershipState(userId);
  return state === "ACTIVE";
}

// Create a Razorpay subscription for the student and persist it in CREATED
// state. Returns only what the browser needs for Checkout (public key id only).
export async function createSubscriptionForUser(opts: {
  userId: string;
  userEmail: string;
  userName: string;
}) {
  const keyId = getPublicKeyId(); // throws PaymentsUnavailableError when not configured
  const amount = await getPlanAmount();

  type CheckoutInfo = {
    subscriptionId: string;
    keyId: string;
    razorpaySubscriptionId: string;
    razorpayPlanId: string;
    amount: number;
    currency: string;
    status: string;
  };

  // Serialize check-then-create per user with a transaction-scoped advisory lock, so a double-click
  // cannot create two Razorpay subscriptions. The lock is held across the Razorpay HTTP call on
  // purpose: the call is the thing being de-duplicated, concurrent requests for the SAME user just
  // wait and then reuse the row. Other users are unaffected (lock key is per user). The timeout is
  // raised above Razorpay's request time so the transaction is not killed mid-call.
  return db.$transaction(
    async (tx): Promise<CheckoutInfo> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sub:" + opts.userId}))`;

      const current = await getSubscriptionState(opts.userId);
      if (current.state === "ACTIVE" && current.subscription?.status === "ACTIVE") {
        throw new SubscriptionError("ALREADY_ACTIVE", "You already have an active membership");
      }

      // Reuse a recent un-paid checkout at the same price instead of piling up Razorpay subscriptions.
      const existing = await tx.subscription.findFirst({
        where: {
          userId: opts.userId,
          status: "CREATED",
          amount,
          createdAt: { gt: new Date(Date.now() - 6 * 3600 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return {
          subscriptionId: existing.razorpaySubscriptionId,
          keyId,
          razorpaySubscriptionId: existing.razorpaySubscriptionId,
          razorpayPlanId: existing.razorpayPlanId,
          amount: existing.amount,
          currency: existing.currency,
          status: existing.status,
        };
      }

      const created = await razorpay.createSubscription({
        userId: opts.userId,
        userEmail: opts.userEmail,
        userName: opts.userName,
        amount,
      });

      await tx.subscription.create({
        data: {
          userId: opts.userId,
          razorpaySubscriptionId: created.razorpaySubscriptionId,
          razorpayPlanId: created.razorpayPlanId,
          status: "CREATED",
          amount: created.amount,
          currency: created.currency,
        },
      });

      return {
        subscriptionId: created.razorpaySubscriptionId,
        keyId,
        razorpaySubscriptionId: created.razorpaySubscriptionId,
        razorpayPlanId: created.razorpayPlanId,
        amount: created.amount,
        currency: created.currency,
        status: created.status,
      };
    },
    { maxWait: 15_000, timeout: 45_000 }
  );
}

// Map a Razorpay subscription entity status to our local status. Returns null when the entity
// status must not change local state (e.g. "created", "authenticated", "pending" retries).
export function mapEntityStatus(status: string | undefined): string | null {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "ACTIVE";
    case "paused":
    case "halted":
      return "HALTED";
    case "cancelled":
      return "CANCELLED";
    case "completed":
    case "expired":
      return "EXPIRED";
    default:
      return null;
  }
}

function toDate(unixSeconds: number | null | undefined): Date | undefined {
  return typeof unixSeconds === "number" && unixSeconds > 0 ? new Date(unixSeconds * 1000) : undefined;
}

// Apply a subscription entity fetched from the Razorpay API (never from the browser) to the local row.
export async function syncSubscriptionFromEntity(
  localId: string,
  entity: RazorpaySubscriptionEntity
): Promise<string> {
  const next = mapEntityStatus(entity.status);
  const start = toDate(entity.current_start);
  const end = toDate(entity.current_end);
  const charge = toDate(entity.charge_at);
  const sub = await db.subscription.update({
    where: { id: localId },
    data: {
      ...(next ? { status: next } : {}),
      ...(start ? { startDate: start } : {}),
      ...(end ? { endDate: end } : {}),
      ...(charge ? { nextBillingDate: charge } : {}),
    },
  });
  return sub.status;
}

// Server-side verification of the Checkout result. The browser is never trusted: the signature is
// checked, the subscription must belong to the caller, and the state is confirmed against the
// Razorpay API before it is marked ACTIVE. The webhook applies the same state idempotently.
export async function verifyCheckout(opts: {
  userId: string;
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ verified: boolean; status?: string }> {
  const local = await db.subscription.findUnique({
    where: { razorpaySubscriptionId: opts.razorpaySubscriptionId },
  });
  if (!local || local.userId !== opts.userId) return { verified: false };

  const ok = razorpay.verifyPaymentSignature(
    opts.razorpaySubscriptionId,
    opts.razorpayPaymentId,
    opts.razorpaySignature
  );
  if (!ok) return { verified: false };

  const entity = await razorpay.fetchSubscription(opts.razorpaySubscriptionId);
  if (entity.id !== opts.razorpaySubscriptionId) return { verified: false };
  const status = await syncSubscriptionFromEntity(local.id, entity);
  return { verified: true, status };
}

// Cancel / pause / resume through the real Razorpay API, then mirror the returned state locally.
// The matching webhook arrives later and is applied idempotently.
export async function changeSubscriptionBilling(
  sub: { id: string; razorpaySubscriptionId: string },
  action: "cancel_now" | "cancel_at_cycle_end" | "pause" | "resume"
): Promise<string> {
  let entity: RazorpaySubscriptionEntity;
  if (action === "pause") entity = await razorpay.pauseSubscription(sub.razorpaySubscriptionId);
  else if (action === "resume") entity = await razorpay.resumeSubscription(sub.razorpaySubscriptionId);
  else entity = await razorpay.cancelSubscription(sub.razorpaySubscriptionId, action === "cancel_at_cycle_end");

  if (action === "cancel_at_cycle_end") {
    // Razorpay keeps the subscription "active" until the cycle ends; the member has opted out now.
    const end = toDate(entity.current_end);
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "CANCELLED", ...(end ? { endDate: end } : {}) },
    });
    return "CANCELLED";
  }
  return syncSubscriptionFromEntity(sub.id, entity);
}

const STALE_PROCESSING_MS = 2 * 60 * 1000;

function webhookStatus(event: string): string | null {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return "ACTIVE";
    case "subscription.paused":
    case "subscription.halted":
      return "HALTED";
    case "subscription.cancelled":
      return "CANCELLED";
    case "subscription.completed":
    case "subscription.expired":
      return "EXPIRED";
    default:
      // authenticated / pending / updated / payment.failed: no status change here.
      return null;
  }
}

// Razorpay's cancelled / expired / completed are terminal: late or reordered activated / charged /
// resumed events must never bring such a subscription back (that would restore access).
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["CANCELLED", "EXPIRED", "COMPLETED"]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export type WebhookTransition = {
  /** Status to write, or null to leave the status untouched. */
  status: string | null;
  /** False when the event must not touch the subscription row at all (status or dates). */
  apply: boolean;
  reason?: "terminal_state";
};

// Pure decision: may `event` change a subscription currently in `current`?
export function decideWebhookTransition(current: string, event: string): WebhookTransition {
  const target = webhookStatus(event);
  if (isTerminalStatus(current)) {
    // Terminal rows are frozen: no status change and no date extension (a late `charged` carries a
    // newer current_end that would re-open access).
    return { status: null, apply: false, reason: "terminal_state" };
  }
  return { status: target, apply: true };
}

// Map a verified Razorpay webhook event to local state changes, transactionally and idempotently
// (WebhookEvent row keyed by provider + Razorpay event id).
export async function applyRazorpayEvent(
  event: { event: string; payload: any },
  eventId: string
): Promise<{ applied: boolean; reason?: string }> {
  const payloadHash = createHash("sha256").update(JSON.stringify(event.payload ?? {})).digest("hex");
  const where = { provider_eventId: { provider: "razorpay", eventId } };
  try {
    await db.webhookEvent.create({
      data: { provider: "razorpay", eventId, eventType: event.event, payloadHash, status: "PROCESSING" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // A previously FAILED event may be retried by Razorpay, and so may a PROCESSING row left behind
      // by a crashed worker (older than the stale window). The conditional updateMany is atomic, so
      // only one retry wins; createdAt is bumped so the reclaimed row is "fresh" again.
      const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
      const claimed = await db.webhookEvent.updateMany({
        where: {
          provider: "razorpay",
          eventId,
          OR: [{ status: "FAILED" }, { status: "PROCESSING", createdAt: { lt: staleBefore } }],
        },
        data: { status: "PROCESSING", errorMessage: null, createdAt: new Date() },
      });
      if (claimed.count === 0) return { applied: false, reason: "duplicate_event" };
    } else {
      throw e;
    }
  }

  const finish = (status: string, errorMessage?: string) =>
    db.webhookEvent.update({
      where,
      data: { status, processedAt: new Date(), ...(errorMessage ? { errorMessage } : {}) },
    });

  try {
    const subEntity = event.payload?.subscription?.entity;
    const payEntity = event.payload?.payment?.entity;

    const subscriptionId: string | undefined =
      subEntity?.id ?? payEntity?.subscription_id ?? payEntity?.notes?.subscription_id;
    let subscription = subscriptionId
      ? await db.subscription.findUnique({ where: { razorpaySubscriptionId: subscriptionId } })
      : null;
    if (!subscription && payEntity?.id) {
      const prior = await db.payment.findUnique({
        where: { razorpayPaymentId: payEntity.id },
        include: { subscription: true },
      });
      subscription = prior?.subscription ?? null;
    }
    if (!subscriptionId && !subscription) {
      await finish("IGNORED");
      return { applied: false, reason: "no_subscription_in_payload" };
    }
    if (!subscription) {
      await finish("FAILED", "no local subscription");
      return { applied: false, reason: "no_local_subscription" };
    }
    const sub = subscription;

    let blockedReason: string | undefined;
    await db.$transaction(async (tx) => {
      // Re-read inside the transaction so the guard sees the latest status.
      const fresh = await tx.subscription.findUnique({ where: { id: sub.id }, select: { status: true } });
      const current = fresh?.status ?? sub.status;
      const decision = decideWebhookTransition(current, event.event);
      if (!decision.apply) blockedReason = decision.reason;
      const nextStatus = decision.status;
      const start = toDate(subEntity?.current_start);
      const end = toDate(subEntity?.current_end);
      const nextBilling = toDate(subEntity?.charge_at) ?? end;

      if (decision.apply && (nextStatus || start || end || nextBilling)) {
        // Compare-and-set on the status we decided from, so a concurrent cancel cannot be overwritten.
        const updated = await tx.subscription.updateMany({
          where: { id: sub.id, status: current },
          data: {
            ...(nextStatus ? { status: nextStatus } : {}),
            ...(start ? { startDate: start } : {}),
            ...(end ? { endDate: end } : {}),
            ...(nextBilling ? { nextBillingDate: nextBilling } : {}),
          },
        });
        if (updated.count === 0) throw new Error("subscription status changed concurrently");
      }

      if (payEntity?.id && typeof payEntity.amount === "number") {
        const status =
          payEntity.status === "captured"
            ? "CAPTURED"
            : payEntity.status === "failed" || event.event === "payment.failed"
              ? "FAILED"
              : payEntity.status === "refunded"
                ? "REFUNDED"
                : "PENDING";
        const created = toDate(payEntity.created_at) ?? new Date();
        // `fee` from Razorpay already includes GST (`tax`); stored as the gateway fee in paise.
        const gatewayFee = typeof payEntity.fee === "number" ? payEntity.fee : 0;
        const existingPayment = await tx.payment.findUnique({ where: { razorpayPaymentId: payEntity.id } });
        if (!existingPayment) {
          await tx.payment.create({
            data: {
              userId: sub.userId,
              subscriptionId: sub.id,
              razorpayPaymentId: payEntity.id,
              amount: payEntity.amount,
              currency: payEntity.currency ?? sub.currency,
              status,
              gatewayFee,
              paidAt: status === "CAPTURED" ? created : null,
            },
          });
        } else if (existingPayment.status !== status && existingPayment.status !== "REFUNDED") {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              status,
              ...(gatewayFee ? { gatewayFee } : {}),
              ...(status === "CAPTURED" ? { paidAt: existingPayment.paidAt ?? created } : {}),
            },
          });
        }
      }

      await tx.webhookEvent.update({
        where,
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    });

    if (blockedReason) return { applied: false, reason: blockedReason };
    return { applied: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finish("FAILED", msg);
    return { applied: false, reason: msg };
  }
}

export const plan = {
  amount: RAZORPAY_PLAN_AMOUNT,
  currency: RAZORPAY_PLAN_CURRENCY,
};
