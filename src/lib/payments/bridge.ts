import { createHmac, timingSafeEqual } from "node:crypto";
import type { GatewayEnv, GatewayName } from "./types";

// Client for the Ishswami payment bridge (ishswamitech-website, /pay/start and /pay/callback).
// The bridge hosts the gateway checkout on the Ishswami domain; this app creates the order,
// signs a short-lived token, and later answers the bridge's server-to-server verify call.

const TOKEN_TTL_SECONDS = 600;
const MAX_CLOCK_DRIFT_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;
const DEFAULT_APP_ID = "vishwayog";

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

export function createBridgeUrl(
  config: BridgeConfig,
  checkout: BridgeCheckout,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const payload = {
    appId: config.appId,
    ...checkout,
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
