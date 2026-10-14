// Database-backed WhatsApp OTP service.
//
// - 6-digit codes from crypto.randomInt, stored only as HMAC-SHA256(AUTH_SECRET)
// - 5 minute expiry, single use, max 5 verify attempts
// - 30s resend cooldown, max 5 sends/hour per phone and per IP, plus a global hourly cap
//   (OTP_GLOBAL_MAX_SENDS_PER_HOUR, default 300); OtpCode is the authority
// - the code is never returned to callers other than via the WhatsApp message

import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { requireAuthSecret } from "@/lib/auth-secret";
import { whatsapp } from "./whatsapp";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_MAX_SENDS_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_GLOBAL_MAX_SENDS_PER_HOUR_DEFAULT = 300;
const HOUR_MS = 60 * 60 * 1000;

/** Global cap on OTP sends across all phones/IPs per hour (env OTP_GLOBAL_MAX_SENDS_PER_HOUR). */
export function globalMaxSendsPerHour(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.OTP_GLOBAL_MAX_SENDS_PER_HOUR ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : OTP_GLOBAL_MAX_SENDS_PER_HOUR_DEFAULT;
}

/** Pure limit decision: true when the send must be rejected as rate limited. */
export function decideSendLimit(c: {
  phoneCount: number;
  ipCount: number;
  globalCount: number;
  globalMax: number;
}): boolean {
  return (
    c.phoneCount >= OTP_MAX_SENDS_PER_HOUR ||
    c.ipCount >= OTP_MAX_SENDS_PER_HOUR ||
    c.globalCount >= c.globalMax
  );
}

// LINK = a signed-in user proving ownership of a WhatsApp number (profile/phone). Same limits.
export type OtpPurpose = "LOGIN" | "REGISTER" | "LINK";

function hashCode(phone: string, code: string): string {
  return createHmac("sha256", requireAuthSecret()).update(`otp:${phone}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export type SendOtpResult =
  | { ok: true }
  | {
      ok: false;
      reason: "COOLDOWN" | "RATE_LIMITED" | "NOT_CONFIGURED" | "DELIVERY_FAILED";
      error: string;
      retryAfterSec?: number;
    };

/** `phone` must already be canonical E.164 digits (see lib/phone.ts). */
export async function sendOtp(opts: {
  phone: string;
  purpose: OtpPurpose;
  ip?: string | null;
}): Promise<SendOtpResult> {
  const { phone, purpose } = opts;
  const ip = opts.ip ?? null;
  const now = Date.now();

  // Opportunistic cleanup of old rows (keep the last 2h so the hourly counters stay accurate).
  db.otpCode
    .deleteMany({ where: { createdAt: { lt: new Date(now - 2 * HOUR_MS) } } })
    .catch(() => {});

  const hourAgo = new Date(now - HOUR_MS);
  const last = await db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (last) {
    const age = now - last.createdAt.getTime();
    if (age < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - age) / 1000);
      return { ok: false, reason: "COOLDOWN", error: `Please wait ${wait}s before requesting another code.`, retryAfterSec: wait };
    }
  }
  const [phoneCount, ipCount, globalCount] = await Promise.all([
    db.otpCode.count({ where: { phone, createdAt: { gte: hourAgo } } }),
    ip ? db.otpCode.count({ where: { ip, createdAt: { gte: hourAgo } } }) : Promise.resolve(0),
    db.otpCode.count({ where: { createdAt: { gte: hourAgo } } }),
  ]);
  if (decideSendLimit({ phoneCount, ipCount, globalCount, globalMax: globalMaxSendsPerHour() })) {
    return { ok: false, reason: "RATE_LIMITED", error: "Too many code requests. Please try again later.", retryAfterSec: 600 };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await db.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(phone, code),
      purpose,
      expiresAt: new Date(now + OTP_TTL_MS),
      ip,
    },
  });
  // Only the newest code is valid.
  await db.otpCode.updateMany({
    where: { phone, consumedAt: null, id: { not: row.id } },
    data: { consumedAt: new Date() },
  });

  const sent = await whatsapp.sendOtp({ to: phone, code });
  if (sent.status === "FAILED") {
    await db.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } }).catch(() => {});
    console.error("[otp] delivery failed", sent.errorCode, sent.errorMessage);
    if (sent.errorCode === "NOT_CONFIGURED") {
      return { ok: false, reason: "NOT_CONFIGURED", error: "Sign-in is temporarily unavailable" };
    }
    return { ok: false, reason: "DELIVERY_FAILED", error: "We couldn't send the code on WhatsApp. Please try again." };
  }
  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; purpose: OtpPurpose }
  | { ok: false; error: string };

const GENERIC = "Incorrect or expired code. Please try again or request a new one.";

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const row = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, error: GENERIC };
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Please request a new code." };
  }
  // Count the attempt atomically before comparing.
  const bumped = await db.otpCode.updateMany({
    where: { id: row.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count !== 1) return { ok: false, error: GENERIC };

  if (!safeEqualHex(hashCode(phone, code.trim()), row.codeHash)) {
    return { ok: false, error: GENERIC };
  }
  // Single use: only one concurrent verifier can win.
  const consumed = await db.otpCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, error: GENERIC };
  return { ok: true, purpose: (row.purpose as OtpPurpose) ?? "LOGIN" };
}
