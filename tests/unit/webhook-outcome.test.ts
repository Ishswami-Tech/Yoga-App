import { describe, expect, test } from "bun:test";
import { decideWebhookResponse } from "../../src/lib/payments/webhook-outcome";

describe("decideWebhookResponse", () => {
  const cases: Array<["order" | "subscription", boolean, string | undefined, 200 | 500, boolean]> = [
    ["order", true, undefined, 200, false],
    ["order", false, "gateway_error", 500, false],
    ["order", false, "gateway_not_configured", 500, false],
    ["order", false, "unknown_order", 200, false],
    ["order", false, "not_paid", 200, false],
    ["order", false, "amount_mismatch", 200, true],
    ["order", false, "something_new", 500, false],
    ["subscription", true, undefined, 200, false],
    ["subscription", false, "duplicate_event", 200, false],
    ["subscription", false, "terminal_state", 200, false],
    ["subscription", false, "no_subscription_in_payload", 200, false],
    ["subscription", false, "no_local_subscription", 500, false],
    ["subscription", false, "subscription status changed concurrently", 500, false],
    ["subscription", false, undefined, 500, false],
  ];
  test.each(cases)("%s applied=%p reason=%p -> %d (alert=%p)", (kind, applied, reason, status, alert) => {
    const d = decideWebhookResponse({ kind, applied, reason });
    expect(d.status).toBe(status);
    expect(d.alert).toBe(alert);
    expect(d.retry).toBe(status === 500);
  });
});
