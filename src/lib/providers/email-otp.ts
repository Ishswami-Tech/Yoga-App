// Database-backed email OTP service (mirrors providers/otp.ts for WhatsApp).
//
// - 6-digit codes from crypto.randomInt, stored only as HMAC-SHA256(AUTH_SECRET)
// - 5 minute expiry, single use, max 5 verify attempts
// - 30s resend cooldown, max 5 sends/hour per address and per IP, plus the global hourly cap
//   (OTP_GLOBAL_MAX_SENDS_PER_HOUR); EmailOtpCode is the authority
// - the code is never logged or returned; it only leaves in the email body

import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { requireAuthSecret } from "@/lib/auth-secret";
import { EMAIL_OTP_TTL_MS } from "@/lib/email-otp-config";
import { globalMaxSendsPerHour } from "./otp";
import { buildLoginCodeEmail, sendEmail } from "./email";

export { EMAIL_OTP_TTL_MS };
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const EMAIL_OTP_MAX_SENDS_PER_HOUR = 5;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
const HOUR_MS = 60 * 60 * 1000;

/** Pure limit decision: true when the send must be rejected as rate limited. */
export function decideEmailSendLimit(c: {
  addressCount: number;
  ipCount: number;
  globalCount: number;
  globalMax: number;
}): boolean {
  return (
    c.addressCount >= EMAIL_OTP_MAX_SENDS_PER_HOUR ||
    c.ipCount >= EMAIL_OTP_MAX_SENDS_PER_HOUR ||
    c.globalCount >= c.globalMax
  );
}

/** Pure pre-check of the newest unconsumed row before the attempt is counted. */
export function decideEmailVerify(
  row: { expiresAt: Date; attempts: number; consumedAt: Date | null } | null,
  now: number,
): "INVALID" | "TOO_MANY_ATTEMPTS" | "CHECK" {
  if (!row || row.consumedAt !== null || row.expiresAt.getTime() < now) return "INVALID";
  if (row.attempts >= EMAIL_OTP_MAX_ATTEMPTS) return "TOO_MANY_ATTEMPTS";
  return "CHECK";
}

export function generateEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashEmailCode(email: string, code: string): string {
  return createHmac("sha256", requireAuthSecret()).update(`email-otp:${email}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export type SendEmailOtpResult =
  | { ok: true }
  | {
      ok: false;
      reason: "COOLDOWN" | "RATE_LIMITED" | "NOT_CONFIGURED" | "DELIVERY_FAILED";
      error: string;
      retryAfterSec?: number;
    };

/** `email` must already be normalised (see lib/email.ts normalizeEmail). */
export async function sendEmailOtp(opts: { email: string; ip?: string | null }): Promise<SendEmailOtpResult> {
  const { email } = opts;
  const ip = opts.ip ?? null;
  const now = Date.now();

  db.emailOtpCode
    .deleteMany({ where: { createdAt: { lt: new Date(now - 2 * HOUR_MS) } } })
    .catch(() => {});

  const hourAgo = new Date(now - HOUR_MS);
  const last = await db.emailOtpCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (last) {
    const age = now - last.createdAt.getTime();
    if (age < EMAIL_OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - age) / 1000);
      return { ok: false, reason: "COOLDOWN", error: `Please wait ${wait}s before requesting another code.`, retryAfterSec: wait };
    }
  }
  const [addressCount, ipCount, globalCount] = await Promise.all([
    db.emailOtpCode.count({ where: { email, createdAt: { gte: hourAgo } } }),
    ip ? db.emailOtpCode.count({ where: { ip, createdAt: { gte: hourAgo } } }) : Promise.resolve(0),
    db.emailOtpCode.count({ where: { createdAt: { gte: hourAgo } } }),
  ]);
  if (decideEmailSendLimit({ addressCount, ipCount, globalCount, globalMax: globalMaxSendsPerHour() })) {
    return { ok: false, reason: "RATE_LIMITED", error: "Too many code requests. Please try again later.", retryAfterSec: 600 };
  }

  const code = generateEmailCode();
  const row = await db.emailOtpCode.create({
    data: { email, codeHash: hashEmailCode(email, code), expiresAt: new Date(now + EMAIL_OTP_TTL_MS), ip },
  });
  // Only the newest code is valid.
  await db.emailOtpCode.updateMany({
    where: { email, consumedAt: null, id: { not: row.id } },
    data: { consumedAt: new Date() },
  });

  const sent = await sendEmail(buildLoginCodeEmail(email, code));
  if (!sent.ok) {
    await db.emailOtpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } }).catch(() => {});
    console.error("[email-otp] delivery failed", sent.errorCode, sent.errorMessage);
    if (sent.errorCode === "NOT_CONFIGURED") {
      return { ok: false, reason: "NOT_CONFIGURED", error: "Email sign-in is temporarily unavailable" };
    }
    return { ok: false, reason: "DELIVERY_FAILED", error: "We couldn't send the code by email. Please try again." };
  }
  return { ok: true };
}

export type VerifyEmailOtpResult = { ok: true } | { ok: false; error: string };

const GENERIC = "Incorrect or expired code. Please try again or request a new one.";

export async function verifyEmailOtp(email: string, code: string): Promise<VerifyEmailOtpResult> {
  const row = await db.emailOtpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const decision = decideEmailVerify(row, Date.now());
  if (decision === "INVALID" || !row) return { ok: false, error: GENERIC };
  if (decision === "TOO_MANY_ATTEMPTS") return { ok: false, error: "Too many attempts. Please request a new code." };

  // Count the attempt atomically before comparing.
  const bumped = await db.emailOtpCode.updateMany({
    where: { id: row.id, consumedAt: null, attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count !== 1) return { ok: false, error: GENERIC };

  if (!safeEqualHex(hashEmailCode(email, code.trim()), row.codeHash)) return { ok: false, error: GENERIC };

  // Single use: only one concurrent verifier can win.
  const consumed = await db.emailOtpCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, error: GENERIC };
  return { ok: true };
}
