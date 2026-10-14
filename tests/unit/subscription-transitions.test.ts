import { describe, expect, test } from "bun:test";
import { decideWebhookTransition, isTerminalStatus } from "../../src/lib/services/subscriptions";

const STATUSES = ["CREATED", "PENDING", "ACTIVE", "HALTED", "FAILED", "CANCELLED", "EXPIRED", "COMPLETED"];
const EVENTS: Record<string, string | null> = {
  "subscription.activated": "ACTIVE",
  "subscription.charged": "ACTIVE",
  "subscription.resumed": "ACTIVE",
  "subscription.paused": "HALTED",
  "subscription.halted": "HALTED",
  "subscription.cancelled": "CANCELLED",
  "subscription.completed": "EXPIRED",
  "subscription.expired": "EXPIRED",
  "subscription.authenticated": null,
  "subscription.pending": null,
  "subscription.updated": null,
  "payment.failed": null,
};

describe("decideWebhookTransition", () => {
  for (const current of STATUSES) {
    for (const [event, target] of Object.entries(EVENTS)) {
      test(`${current} + ${event}`, () => {
        const d = decideWebhookTransition(current, event);
        if (isTerminalStatus(current)) {
          expect(d).toEqual({ status: null, apply: false, reason: "terminal_state" });
        } else {
          expect(d).toEqual({ status: target, apply: true });
        }
      });
    }
  }

  test("terminal set is CANCELLED, EXPIRED, COMPLETED only", () => {
    expect(STATUSES.filter(isTerminalStatus)).toEqual(["CANCELLED", "EXPIRED", "COMPLETED"]);
  });

  test("HALTED and PAUSED-as-HALTED recover via charged/resumed", () => {
    expect(decideWebhookTransition("HALTED", "subscription.charged").status).toBe("ACTIVE");
    expect(decideWebhookTransition("HALTED", "subscription.resumed").status).toBe("ACTIVE");
  });
});
