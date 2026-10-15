import { describe, expect, test } from "bun:test";
import {
  ACTIVE_SUBSCRIPTION_GRACE_MS,
  activeMembersWhere,
  deriveSubscriptionState,
  isEntitled,
  selectBestSubscription,
} from "../../src/lib/services/membership";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const H = 3_600_000;

describe("isEntitled rule table", () => {
  const sub = (status: string, endDate: Date | null) => ({ subscriptions: [{ status, endDate }] });
  const ord = (status: string, coversUntil: Date | null) => ({ orders: [{ status, coversUntil }] });
  const cases: Array<[string, Parameters<typeof isEntitled>[0], boolean]> = [
    ["ACTIVE no end", sub("ACTIVE", null), true],
    ["ACTIVE future end", sub("ACTIVE", at(H)), true],
    ["ACTIVE ended 1h ago (grace)", sub("ACTIVE", at(-H)), true],
    ["ACTIVE ended exactly 24h ago", sub("ACTIVE", at(-ACTIVE_SUBSCRIPTION_GRACE_MS)), true],
    ["ACTIVE ended 24h+1ms ago", sub("ACTIVE", at(-ACTIVE_SUBSCRIPTION_GRACE_MS - 1)), false],
    ["CANCELLED future end", sub("CANCELLED", at(H)), true],
    ["CANCELLED ended 1h ago (no grace)", sub("CANCELLED", at(-H)), false],
    ["CANCELLED no end", sub("CANCELLED", null), false],
    ["CREATED", sub("CREATED", null), false],
    ["PENDING", sub("PENDING", at(H)), false],
    ["HALTED", sub("HALTED", at(H)), false],
    ["EXPIRED", sub("EXPIRED", at(H)), false],
    ["FAILED", sub("FAILED", null), false],
    ["PAID order future", ord("PAID", at(H)), true],
    ["PAID order just ended", ord("PAID", at(-1)), false],
    ["PAID order no coverage", ord("PAID", null), false],
    ["CREATED order", ord("CREATED", at(H)), false],
    ["FAILED order", ord("FAILED", at(H)), false],
    ["nothing", {}, false],
    [
      "expired sub + paid order",
      { subscriptions: [{ status: "EXPIRED", endDate: at(-H) }], orders: [{ status: "PAID", coversUntil: at(H) }] },
      true,
    ],
  ];
  test.each(cases)("%s -> %p", (_n, input, want) => expect(isEntitled(input, NOW)).toBe(want));
});

describe("selectBestSubscription", () => {
  const row = (id: string, status: string, endDate: Date | null, ageH: number) => ({
    id,
    status,
    endDate,
    createdAt: at(-ageH * H),
  });
  test("empty -> null", () => expect(selectBestSubscription([], NOW)).toBeNull());
  test("newer CREATED does not hide paid CANCELLED", () => {
    const r = selectBestSubscription([row("new", "CREATED", null, 1), row("old", "CANCELLED", at(5 * H), 100)], NOW);
    expect(r?.id).toBe("old");
  });
  test("newer PENDING does not hide ACTIVE", () => {
    const r = selectBestSubscription([row("old", "ACTIVE", at(5 * H), 100), row("new", "PENDING", null, 1)], NOW);
    expect(r?.id).toBe("old");
  });
  test("newer FAILED does not hide ACTIVE (input order irrelevant)", () => {
    const r = selectBestSubscription([row("new", "FAILED", null, 1), row("old", "ACTIVE", null, 100)], NOW);
    expect(r?.id).toBe("old");
  });
  test("several entitling rows -> newest", () => {
    const r = selectBestSubscription([row("a", "ACTIVE", null, 50), row("b", "CANCELLED", at(H), 10)], NOW);
    expect(r?.id).toBe("b");
  });
  test("none entitling -> latest", () => {
    const r = selectBestSubscription([row("old", "EXPIRED", at(-100 * H), 500), row("new", "CREATED", null, 1)], NOW);
    expect(r?.id).toBe("new");
  });
});

describe("deriveSubscriptionState", () => {
  const cases: Array<[string, string | null, Date | null, string]> = [
    ["none", null, null, "NONE"],
    ["ACTIVE future", "ACTIVE", at(H), "ACTIVE"],
    ["ACTIVE in grace", "ACTIVE", at(-H), "ACTIVE"],
    ["ACTIVE past grace", "ACTIVE", at(-25 * H), "EXPIRED"],
    ["CANCELLED paid", "CANCELLED", at(H), "ACTIVE"],
    ["CANCELLED over", "CANCELLED", at(-H), "CANCELLED"],
    ["HALTED", "HALTED", at(H), "HALTED"],
    ["EXPIRED", "EXPIRED", null, "EXPIRED"],
    ["FAILED", "FAILED", null, "EXPIRED"],
    ["CREATED", "CREATED", null, "PENDING"],
    ["PENDING", "PENDING", null, "PENDING"],
  ];
  test.each(cases)("%s -> %s", (_n, status, end, want) =>
    expect(deriveSubscriptionState(status ? { status, endDate: end } : null, NOW)).toBe(want)
  );
});

describe("activeMembersWhere", () => {
  test("shape: active student AND entitlement OR-clauses", () => {
    const w = activeMembersWhere(NOW) as any;
    expect(w.role).toBe("STUDENT");
    expect(w.status).toBe("ACTIVE");
    const or = w.AND[0].OR;
    expect(or).toHaveLength(3);
    expect(or[0].subscriptions.some.OR[1].endDate.gte).toEqual(at(-ACTIVE_SUBSCRIPTION_GRACE_MS));
    expect(or[1].subscriptions.some).toEqual({ status: "CANCELLED", endDate: { gte: NOW } });
    expect(or[2].paymentOrders.some).toEqual({ status: "PAID", coversUntil: { gte: NOW } });
  });
});
