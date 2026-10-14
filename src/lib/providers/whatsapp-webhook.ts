import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison; false (never throws) on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const SIG_PREFIX = "sha256=";

/**
 * Verifies Meta's X-Hub-Signature-256 header ("sha256=<hex>") as the
 * HMAC-SHA256 of the raw request body keyed with the app secret.
 */
export function verifyMetaSignature(
  secret: string | undefined,
  rawBody: string,
  header: string | null | undefined,
): boolean {
  if (!secret || !header || !header.startsWith(SIG_PREFIX)) return false;
  const provided = header.slice(SIG_PREFIX.length);
  if (!/^[0-9a-fA-F]{64}$/.test(provided)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqual(expected, provided.toLowerCase());
}

export interface HandshakeParams {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}

export type HandshakeResult =
  | { ok: true; challenge: string }
  | { ok: false; status: 403 | 503 };

/** Meta's GET verification handshake (hub.mode / hub.verify_token / hub.challenge). */
export function verifyMetaHandshake(
  expectedToken: string | undefined,
  params: HandshakeParams,
): HandshakeResult {
  if (!expectedToken) return { ok: false, status: 503 };
  if (params.mode !== "subscribe" || !params.token || params.challenge === null) {
    return { ok: false, status: 403 };
  }
  if (!safeEqual(params.token, expectedToken)) return { ok: false, status: 403 };
  return { ok: true, challenge: params.challenge };
}
