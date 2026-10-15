// Single source of truth for "who is an active member".
//
// A student is entitled when ANY of these holds:
//   1. an ACTIVE subscription whose endDate is null or not older than the grace window,
//   2. a CANCELLED subscription whose endDate is still in the future (paid time left),
//   3. a PAID one-time PaymentOrder whose coversUntil is still in the future.
//
// Everything that decides membership (hasActiveMembership, reminders, bulk messages, notifications)
// must go through isEntitled / activeMembersWhere so the rules cannot drift apart.

import type { Prisma } from "@prisma/client";

/**
 * Razorpay renews an ACTIVE subscription a little after current_end, and the webhook that moves
 * endDate forward can lag. An ACTIVE subscription whose endDate has only just passed therefore keeps
 * counting as a member for this long, so a renewal in flight never locks a paying member out.
 * CANCELLED subscriptions and one-time orders get no grace: their end is final.
 */
export const ACTIVE_SUBSCRIPTION_GRACE_MS = 24 * 60 * 60 * 1000;

export interface EntitlementSubscription {
  readonly status: string;
  readonly endDate: Date | null;
}

export interface EntitlementOrder {
  readonly status: string;
  readonly coversUntil: Date | null;
}

export function isSubscriptionEntitled(sub: EntitlementSubscription, now: Date = new Date()): boolean {
  if (sub.status === "ACTIVE") {
    return sub.endDate === null || sub.endDate.getTime() >= now.getTime() - ACTIVE_SUBSCRIPTION_GRACE_MS;
  }
  if (sub.status === "CANCELLED") {
    return sub.endDate !== null && sub.endDate.getTime() >= now.getTime();
  }
  return false;
}

export function isOrderEntitled(order: EntitlementOrder, now: Date = new Date()): boolean {
  return order.status === "PAID" && order.coversUntil !== null && order.coversUntil.getTime() >= now.getTime();
}

export function isEntitled(
  input: {
    readonly subscriptions?: readonly EntitlementSubscription[];
    readonly orders?: readonly EntitlementOrder[];
  },
  now: Date = new Date()
): boolean {
  return (
    (input.subscriptions ?? []).some((s) => isSubscriptionEntitled(s, now)) ||
    (input.orders ?? []).some((o) => isOrderEntitled(o, now))
  );
}

export type SubscriptionDerivedState = "NONE" | "PENDING" | "ACTIVE" | "EXPIRED" | "HALTED" | "CANCELLED";

export interface SelectableSubscription extends EntitlementSubscription {
  readonly createdAt: Date;
}

/**
 * Picks the subscription row that describes the member's access. A newer CREATED / PENDING / FAILED
 * row (e.g. a fresh checkout) must never hide an older row that still grants access, so entitling
 * rows win (newest first); otherwise the latest row by createdAt is used.
 */
export function selectBestSubscription<T extends SelectableSubscription>(
  rows: readonly T[],
  now: Date = new Date()
): T | null {
  if (rows.length === 0) return null;
  const newestFirst = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return newestFirst.find((r) => isSubscriptionEntitled(r, now)) ?? newestFirst[0];
}

/** Membership state implied by one subscription row. */
export function deriveSubscriptionState(sub: EntitlementSubscription | null, now: Date = new Date()): SubscriptionDerivedState {
  if (!sub) return "NONE";
  if (isSubscriptionEntitled(sub, now)) return "ACTIVE";
  switch (sub.status) {
    case "CANCELLED":
      return "CANCELLED";
    case "HALTED":
      return "HALTED";
    case "ACTIVE": // past endDate + grace
    case "EXPIRED":
    case "FAILED":
      return "EXPIRED";
    default:
      return "PENDING"; // CREATED / PENDING
  }
}

/** Prisma filter equivalent to isEntitled, for user queries. */
export function entitlementWhere(now: Date = new Date()): Prisma.UserWhereInput {
  const graceFloor = new Date(now.getTime() - ACTIVE_SUBSCRIPTION_GRACE_MS);
  return {
    OR: [
      {
        subscriptions: {
          some: { status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gte: graceFloor } }] },
        },
      },
      { subscriptions: { some: { status: "CANCELLED", endDate: { gte: now } } } },
      { paymentOrders: { some: { status: "PAID", coversUntil: { gte: now } } } },
    ],
  };
}

/** Active, entitled students. */
export function activeMembersWhere(now: Date = new Date()): Prisma.UserWhereInput {
  return {
    role: "STUDENT",
    status: "ACTIVE",
    AND: [entitlementWhere(now)],
  };
}
