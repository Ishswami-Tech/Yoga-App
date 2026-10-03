// OTP (one-time password) service for WhatsApp login.
//
// Generates 6-digit codes, stores them in-memory with a 5-minute expiry,
// and verifies them. In production this would use a distributed cache
// (Redis) or the database; for the sandbox we use an in-memory Map.
//
// The OTP is "sent" via the WhatsApp adapter — in production this would
// call the Meta WhatsApp Business Cloud API to deliver the code as a
// text message. In the mock adapter, the code is just returned (and
// logged to the console) so the dev flow can be exercised end-to-end.

import { whatsapp } from "./whatsapp";

// In-memory OTP store: phone -> { code, expiresAt, attempts }
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds between sends
const MAX_ATTEMPTS = 5;

const lastSentAt = new Map<string, number>();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export type SendOtpResult = {
  ok: boolean;
  error?: string;
  // In dev/mock mode, the code is returned so the UI can display it.
  // In production this would NEVER be returned to the client.
  devCode?: string;
};

export async function sendOtp(phone: string): Promise<SendOtpResult> {
  // Normalize phone
  const normalized = phone.replace(/[\s-]/g, "");

  // Rate limit: prevent resending within 30s
  const lastSent = lastSentAt.get(normalized);
  if (lastSent && Date.now() - lastSent < OTP_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
    return {
      ok: false,
      error: `Please wait ${waitSec}s before requesting another code.`,
    };
  }

  const code = generateCode();
  const expiresAt = Date.now() + OTP_TTL_MS;

  otpStore.set(normalized, { code, expiresAt, attempts: 0 });
  lastSentAt.set(normalized, Date.now());

  // "Send" the OTP via WhatsApp — in the mock adapter this is a no-op
  // that just returns success. The code is returned here for dev display.
  await whatsapp.sendClassReminder({
    toWhatsapp: normalized,
    templateName: "otp_login",
    studentName: "Yoga Student",
    classTime: "—",
    meetUrl: `Your Prana Live Yoga login code is ${code}`,
    className: "OTP Login",
  });

  return {
    ok: true,
    devCode: code, // ONLY in mock mode — remove in production
  };
}

export type VerifyOtpResult = {
  ok: boolean;
  error?: string;
};

export function verifyOtp(phone: string, code: string): VerifyOtpResult {
  const normalized = phone.replace(/[\s-]/g, "");
  const entry = otpStore.get(normalized);

  if (!entry) {
    return { ok: false, error: "No code was sent to this number. Please request a new one." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalized);
    return { ok: false, error: "The code has expired. Please request a new one." };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalized);
    return { ok: false, error: "Too many attempts. Please request a new code." };
  }

  entry.attempts++;

  if (entry.code !== code.trim()) {
    return { ok: false, error: "Incorrect code. Please try again." };
  }

  // Success — clean up
  otpStore.delete(normalized);
  lastSentAt.delete(normalized);
  return { ok: true };
}
