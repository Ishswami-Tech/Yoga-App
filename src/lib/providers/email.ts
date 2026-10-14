// Transactional email via the ZeptoMail (Zoho) REST API.
// Env: ZEPTOMAIL_TOKEN (Send Mail Token), EMAIL_FROM_ADDRESS (on a domain verified in ZeptoMail),
// EMAIL_FROM_NAME (optional, default APP_NAME), ZEPTOMAIL_API_URL (optional, default India DC).

import { APP_NAME } from "@/lib/brand";
import { EMAIL_OTP_TTL_MINUTES } from "@/lib/email-otp-config";

export const DEFAULT_ZEPTOMAIL_API_URL = "https://api.zeptomail.in";
const TIMEOUT_MS = 10_000;
const TOKEN_PREFIX = /^zoho-enczapikey\s+/i;

export type EmailMessage = { to: string; subject: string; html: string; text: string };
export type SendEmailResult = { ok: boolean; errorCode?: string; errorMessage?: string };

type EmailConfig = { token: string; fromAddress: string; fromName: string; baseUrl: string };

function config(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  // Tolerate the owner pasting the token with the "Zoho-enczapikey " prefix.
  const token = env.ZEPTOMAIL_TOKEN?.trim().replace(TOKEN_PREFIX, "").trim();
  const fromAddress = env.EMAIL_FROM_ADDRESS?.trim();
  if (!token || !fromAddress) return null;
  const fromName = env.EMAIL_FROM_NAME?.trim() || APP_NAME;
  const baseUrl = (env.ZEPTOMAIL_API_URL?.trim() || DEFAULT_ZEPTOMAIL_API_URL).replace(/\/+$/, "");
  return { token, fromAddress, fromName, baseUrl };
}

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return config(env) !== null;
}

export async function sendEmail(msg: EmailMessage): Promise<SendEmailResult> {
  const cfg = config();
  if (!cfg) {
    return {
      ok: false,
      errorCode: "NOT_CONFIGURED",
      errorMessage: "Email is not configured (ZEPTOMAIL_TOKEN / EMAIL_FROM_ADDRESS missing)",
    };
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/v1.1/email`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-enczapikey ${cfg.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: { address: cfg.fromAddress, name: cfg.fromName },
        to: [{ email_address: { address: msg.to, name: msg.to } }],
        subject: msg.subject,
        htmlbody: msg.html,
        textbody: msg.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    const detail = (await res.json().catch(() => null)) as {
      error?: { code?: unknown; message?: unknown };
      message?: unknown;
    } | null;
    const apiCode = typeof detail?.error?.code === "string" ? detail.error.code : null;
    const apiMessage =
      typeof detail?.error?.message === "string"
        ? detail.error.message
        : typeof detail?.message === "string"
          ? detail.message
          : res.statusText;
    return {
      ok: false,
      errorCode: apiCode ? `HTTP_${res.status}_${apiCode}` : `HTTP_${res.status}`,
      errorMessage: String(apiMessage).slice(0, 300),
    };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      errorCode: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      errorMessage: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Branded login-code message. The code is only ever placed in this message body. */
export function buildLoginCodeEmail(to: string, code: string): EmailMessage {
  const app = escapeHtml(APP_NAME);
  const safeCode = escapeHtml(code);
  const mins = EMAIL_OTP_TTL_MINUTES;
  const text =
    `Your ${APP_NAME} login code is ${code}\n\n` +
    `It expires in ${mins} minutes. If you didn't request this, you can safely ignore this email.\n`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">` +
    `<h2 style="margin:0 0 16px;color:#065f46">${app}</h2>` +
    `<p style="margin:0 0 12px">Your login code is:</p>` +
    `<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:0 0 16px">${safeCode}</p>` +
    `<p style="margin:0 0 8px">This code expires in ${mins} minutes.</p>` +
    `<p style="margin:0;color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>` +
    `</div>`;
  return { to, subject: `Your ${APP_NAME} login code`, html, text };
}
