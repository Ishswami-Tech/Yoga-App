import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { APP_NAME } from "@/lib/brand";
import type { GatewayEnv, GatewayName } from "./types";

// Client for the Ishswami payment bridge (ishswamitech-website, /pay/start and /pay/callback).
// The bridge hosts the gateway checkout on the Ishswami domain; this app creates the order,
// signs a short-lived token, and later answers the bridge's server-to-server verify call.

const TOKEN_TTL_SECONDS = 600;
const MAX_CLOCK_DRIFT_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;
const DEFAULT_APP_ID = "vishwayog";

const MAX_DISPLAY_NAME = 60;
const MAX_LOGO_URL = 300;
const MAX_NOTE = 140;
const MAX_CUSTOMER_FIELD = 120;
const MAX_CUSTOMER_ENC = 1024;
const PREFILL_KEY_LABEL = "bridge-prefill:v1:";

/** Shown in the gateway window so students know who collects the money. */
export const BRIDGE_PAYMENT_NOTE = `Payments for ${APP_NAME} are securely processed by Ishswami Tech.`;

export interface BridgeCustomer {
  readonly name?: string;
  readonly email?: string;
  readonly contact?: string;
}

export interface BridgeConfig {
  readonly baseUrl: string;
  readonly appId: string;
  readonly secret: string;
}

export interface BridgeCheckout {
  readonly provider: GatewayName;
  readonly orderId: string;
  /** Paise; passed straight to the gateway. */
  readonly amount: number;
  readonly currency: string;
  readonly description?: string;
  readonly displayAmount?: string;
  readonly paymentSessionId?: string;
  readonly razorpayKeyId?: string;
  readonly razorpayMode?: "order" | "subscription";
  readonly gatewayRedirectUrl?: string;
  /** Business name shown in the gateway window (<= 60 chars). */
  readonly displayName?: string;
  /** https logo URL shown in the gateway window (<= 300 chars). */
  readonly logoUrl?: string;
  /** Short note shown to the payer (<= 140 chars). */
  readonly note?: string;
  /** Output of encryptBridgeCustomer: the payer's contact details, encrypted. */
  readonly customerEnc?: string;
}

export function loadBridgeConfig(env: GatewayEnv): BridgeConfig | null {
  const baseUrl = (env.PAYMENT_BRIDGE_URL ?? "").trim().replace(/\/+$/u, "");
  const secret = (env.PAYMENT_BRIDGE_SECRET ?? "").trim();
  if (!baseUrl || secret.length < MIN_SECRET_LENGTH) {
    return null;
  }
  return { baseUrl, appId: (env.PAYMENT_BRIDGE_APP_ID ?? "").trim() || DEFAULT_APP_ID, secret };
}

function hmacBase64Url(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function prefillKey(secret: string): Buffer {
  return createHash("sha256").update(`${PREFILL_KEY_LABEL}${secret}`, "utf8").digest();
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().slice(0, MAX_CUSTOMER_FIELD);
  return trimmed ? trimmed : undefined;
}

/**
 * AES-256-GCM, key = SHA-256("bridge-prefill:v1:" + secret), 12-byte random IV, 16-byte tag.
 * Format: base64url(iv).base64url(tag).base64url(ciphertext) over JSON {name?,email?,contact?}.
 * Returns null when there is nothing to send.
 */
export function encryptBridgeCustomer(secret: string, customer: BridgeCustomer): string | null {
  const name = clean(customer.name);
  const email = clean(customer.email);
  const contact = clean(customer.contact);
  if (!name && !email && !contact) {
    return null;
  }
  const plaintext = JSON.stringify({
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(contact ? { contact } : {}),
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", prefillKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

/** Inverse of encryptBridgeCustomer; null on any tampering, wrong key or malformed input. */
export function decryptBridgeCustomer(secret: string, value: string): BridgeCustomer | null {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64url"));
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return null;
    }
    const decipher = createDecipheriv("aes-256-gcm", prefillKey(secret), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const pick = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : undefined);
    return { name: pick("name"), email: pick("email"), contact: pick("contact") };
  } catch {
    return null;
  }
}

/** Display fields must fit the bridge's limits: truncate text, drop anything unusable. */
function sanitizeDisplayFields(checkout: BridgeCheckout): BridgeCheckout {
  const { displayName, logoUrl, note, customerEnc, ...rest } = checkout;
  const name = displayName?.trim().slice(0, MAX_DISPLAY_NAME);
  const trimmedNote = note?.trim().slice(0, MAX_NOTE);
  return {
    ...rest,
    ...(name ? { displayName: name } : {}),
    ...(logoUrl && logoUrl.length <= MAX_LOGO_URL && /^https:\/\//u.test(logoUrl) ? { logoUrl } : {}),
    ...(trimmedNote ? { note: trimmedNote } : {}),
    ...(customerEnc && customerEnc.length <= MAX_CUSTOMER_ENC ? { customerEnc } : {}),
  };
}

export function createBridgeUrl(
  config: BridgeConfig,
  checkout: BridgeCheckout,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const payload = {
    appId: config.appId,
    ...sanitizeDisplayFields(checkout),
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${body}.${hmacBase64Url(config.secret, body)}`;
  return `${config.baseUrl}/pay/start?token=${token}`;
}

export interface BridgeAuthHeaders {
  readonly timestamp: string | null;
  readonly signature: string | null;
}

/** Authenticates the bridge's verify call: hex HMAC-SHA256 over `${timestamp}.${rawBody}`. */
export function verifyBridgeRequest(
  config: BridgeConfig,
  headers: BridgeAuthHeaders,
  rawBody: string,
  nowMs: number = Date.now(),
): boolean {
  const { timestamp, signature } = headers;
  if (!timestamp || !signature || !/^\d+$/u.test(timestamp)) {
    return false;
  }
  if (Math.abs(Math.floor(nowMs / 1000) - Number(timestamp)) > MAX_CLOCK_DRIFT_SECONDS) {
    return false;
  }
  const expected = Buffer.from(createHmac("sha256", config.secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  const provided = Buffer.from(signature);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
