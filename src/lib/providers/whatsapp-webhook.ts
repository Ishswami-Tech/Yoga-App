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

// ---------------------------------------------------------------------------
// Status callbacks (entry[] / changes[] / statuses[])
// ---------------------------------------------------------------------------

export type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface ParsedStatus {
  id: string;
  status: Exclude<MessageStatus, "QUEUED">;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Hard cap on statuses processed per webhook request. */
export const MAX_STATUSES_PER_REQUEST = 200;

const META_STATUS: Record<string, ParsedStatus["status"]> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

// Processing order inside one batch so sent -> delivered -> read apply in sequence.
const BATCH_ORDER: Record<ParsedStatus["status"], number> = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };

/**
 * Statuses a row may currently have for `next` to be applied. SENT < DELIVERED < READ move forward only;
 * FAILED is terminal (never overwrites READ or another FAILED, and nothing overwrites it).
 */
export function allowedPriorStatuses(next: ParsedStatus["status"]): MessageStatus[] {
  switch (next) {
    case "SENT":
      return ["QUEUED"];
    case "DELIVERED":
      return ["QUEUED", "SENT"];
    case "READ":
      return ["QUEUED", "SENT", "DELIVERED"];
    case "FAILED":
      return ["QUEUED", "SENT", "DELIVERED"];
  }
}

/** Pure forward-only rule, mirroring allowedPriorStatuses. */
export function canAdvance(current: string, next: ParsedStatus["status"]): boolean {
  return (allowedPriorStatuses(next) as string[]).includes(current);
}

/** Flattens every entry/change/status in a Meta payload; ignores malformed items; capped and ordered. */
export function extractStatuses(payload: unknown, cap: number = MAX_STATUSES_PER_REQUEST): ParsedStatus[] {
  const out: ParsedStatus[] = [];
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  outer: for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown } })?.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const s of statuses) {
        const raw = s as { id?: unknown; status?: unknown; errors?: { code?: unknown; title?: unknown }[] };
        if (typeof raw?.id !== "string" || !raw.id) continue;
        const mapped = typeof raw.status === "string" ? META_STATUS[raw.status] : undefined;
        if (!mapped) continue;
        const err = Array.isArray(raw.errors) ? raw.errors[0] : undefined;
        out.push({
          id: raw.id,
          status: mapped,
          errorCode: mapped === "FAILED" && err?.code != null ? String(err.code).slice(0, 50) : null,
          errorMessage: mapped === "FAILED" && typeof err?.title === "string" ? err.title.slice(0, 300) : null,
        });
        if (out.length >= cap) break outer;
      }
    }
  }
  return out.sort((a, b) => BATCH_ORDER[a.status] - BATCH_ORDER[b.status]);
}
