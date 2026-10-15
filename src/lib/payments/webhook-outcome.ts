// Maps the result of processing a Razorpay webhook to an HTTP response decision.
//
// Razorpay retries any non-2xx response (for up to 24h), so transient failures must answer 5xx and
// permanent / benign outcomes must answer 200 (retrying them can never help and just adds noise).

export interface WebhookDecision {
  readonly status: 200 | 500;
  /** Transient: Razorpay should retry. */
  readonly retry: boolean;
  /** Permanent problem that needs a human; log at alert level (no PII). */
  readonly alert: boolean;
}

export type WebhookResultKind = "order" | "subscription";

export interface WebhookResultInput {
  readonly kind: WebhookResultKind;
  readonly applied: boolean;
  readonly reason?: string | null;
}

const OK: WebhookDecision = { status: 200, retry: false, alert: false };
const RETRY: WebhookDecision = { status: 500, retry: true, alert: false };

// settleOrder reasons that are final: retrying will not change them.
const ORDER_BENIGN_REASONS: ReadonlySet<string> = new Set(["unknown_order", "not_paid"]);
// applyRazorpayEvent reasons that are final.
const SUBSCRIPTION_BENIGN_REASONS: ReadonlySet<string> = new Set([
  "duplicate_event",
  "terminal_state",
  "no_subscription_in_payload",
]);

export function decideWebhookResponse(input: WebhookResultInput): WebhookDecision {
  if (input.applied) return OK;
  const reason = input.reason ?? "";

  if (input.kind === "order") {
    if (reason === "amount_mismatch") return { status: 200, retry: false, alert: true };
    if (ORDER_BENIGN_REASONS.has(reason)) return OK;
    // gateway_error, gateway_not_configured, or anything unexpected: let Razorpay retry.
    return RETRY;
  }

  if (SUBSCRIPTION_BENIGN_REASONS.has(reason)) return OK;
  // no_local_subscription (race with checkout creation) and any error message (event marked FAILED).
  return RETRY;
}
