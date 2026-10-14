import { isIP } from "node:net";

// Per-instance in-memory throttle. This is only a SECOND layer in front of the
// database-backed limits in providers/otp.ts (the OtpCode table is the authority).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function throttle(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Number of trusted reverse proxies that APPEND to X-Forwarded-For (env
 * TRUSTED_PROXY_HOPS, default 1). The client IP is counted from the RIGHT,
 * because everything left of the trusted proxies is client-controlled.
 * Behind Cloudflare + the Temps proxy the right value is likely 2, but verify
 * it against real request headers before changing it.
 */
function trustedHops(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Pure parser: pick the client IP from XFF (right-counted) or x-real-ip. */
export function parseClientIp(xff: string | null, realIp: string | null, hops: number): string | null {
  const h = Number.isInteger(hops) && hops >= 1 ? hops : 1;
  const parts = (xff ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const candidate = parts.length > 0 ? parts[Math.max(0, parts.length - h)] : realIp?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/** Client IP for rate limiting; null if it cannot be determined or is malformed. */
export function clientIp(req: Request): string | null {
  return parseClientIp(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"), trustedHops());
}
