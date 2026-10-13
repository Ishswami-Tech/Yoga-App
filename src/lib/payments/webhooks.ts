import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Webhook authentication helpers. Webhooks only *trigger* a re-check: settleOrder() reads the
// real status from the gateway API, so a forged or replayed webhook can never grant access.

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Cashfree: base64(HMAC-SHA256(client secret, x-webhook-timestamp + rawBody)). */
export function verifyCashfreeSignature(
  secret: string,
  timestamp: string | null,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!secret || !timestamp || !signature) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  return safeEqual(expected, signature);
}

/** PhonePe: Authorization header carries hex SHA-256 of `username:password` set in the dashboard. */
export function verifyPhonePeAuthorization(
  username: string,
  password: string,
  authorization: string | null,
): boolean {
  if (!username || !password || !authorization) {
    return false;
  }
  const provided = authorization.trim().replace(/^sha256\s+/iu, "");
  const expected = createHash("sha256").update(`${username}:${password}`).digest("hex");
  return safeEqual(expected.toLowerCase(), provided.toLowerCase());
}

function pick(value: unknown, ...path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current ? current : null;
}

export function extractCashfreeOrderId(body: unknown): string | null {
  return pick(body, "data", "order", "order_id");
}

export function extractPhonePeOrderId(body: unknown): string | null {
  return pick(body, "payload", "merchantOrderId");
}
