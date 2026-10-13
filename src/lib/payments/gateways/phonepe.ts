import type { CreatedGatewayOrder, FetchLike, Gateway, GatewayEnv, GatewayStatus, OrderRequest } from "../types";
import { requestJson } from "./http";

// PhonePe Standard Checkout v2 (hosted page). The browser is sent to `redirectUrl`, and PhonePe
// returns it to the bridge callback afterwards.
const HOSTS = {
  production: {
    identity: "https://api.phonepe.com/apis/identity-manager",
    pg: "https://api.phonepe.com/apis/pg",
  },
  sandbox: {
    identity: "https://api-preprod.phonepe.com/apis/pg-sandbox",
    pg: "https://api-preprod.phonepe.com/apis/pg-sandbox",
  },
} as const;
const ORDER_EXPIRY_SECONDS = 1200;
const TOKEN_EXPIRY_MARGIN_SECONDS = 60;

interface PhonePeTokenResponse {
  access_token?: string;
  expires_at?: number;
}

interface PhonePePayResponse {
  redirectUrl?: string;
}

interface PhonePeStatusResponse {
  state?: string;
  amount?: number;
  paymentDetails?: Array<{ transactionId?: string; state?: string }>;
}

export function createPhonePeGateway(env: GatewayEnv, fetchImpl: FetchLike = fetch): Gateway | null {
  const clientId = env.PHONEPE_CLIENT_ID?.trim();
  const clientSecret = env.PHONEPE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  const clientVersion = env.PHONEPE_CLIENT_VERSION?.trim() || "1";
  const hosts = env.PHONEPE_ENVIRONMENT?.trim().toLowerCase() === "production" ? HOSTS.production : HOSTS.sandbox;

  let cachedToken: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_SECONDS > nowSeconds) {
      return cachedToken.value;
    }
    const response = await requestJson<PhonePeTokenResponse>("PhonePe", fetchImpl, `${hosts.identity}/v1/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId as string,
        client_version: clientVersion,
        client_secret: clientSecret as string,
        grant_type: "client_credentials",
      }).toString(),
    });
    if (!response.access_token) {
      throw new Error("PhonePe did not return an access token");
    }
    cachedToken = {
      value: response.access_token,
      expiresAt: response.expires_at ?? nowSeconds + 300,
    };
    return cachedToken.value;
  }

  async function authHeaders(): Promise<Record<string, string>> {
    return { "Content-Type": "application/json", Authorization: `O-Bearer ${await getToken()}` };
  }

  return {
    name: "phonepe",

    async createOrder(request: OrderRequest): Promise<CreatedGatewayOrder> {
      const response = await requestJson<PhonePePayResponse>("PhonePe", fetchImpl, `${hosts.pg}/checkout/v2/pay`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          merchantOrderId: request.localOrderId,
          amount: request.amountPaise,
          expireAfter: ORDER_EXPIRY_SECONDS,
          paymentFlow: { type: "PG_CHECKOUT", merchantUrls: { redirectUrl: request.returnUrl } },
        }),
      });
      if (!response.redirectUrl) {
        throw new Error("PhonePe did not return a checkout URL");
      }
      return { providerOrderId: request.localOrderId, checkout: { gatewayRedirectUrl: response.redirectUrl } };
    },

    async fetchStatus(providerOrderId: string): Promise<GatewayStatus> {
      const order = await requestJson<PhonePeStatusResponse>(
        "PhonePe",
        fetchImpl,
        `${hosts.pg}/checkout/v2/order/${encodeURIComponent(providerOrderId)}/status`,
        { method: "GET", headers: await authHeaders() },
      );
      const state = (order.state ?? "").toUpperCase();
      if (state === "COMPLETED") {
        const transactionId = order.paymentDetails?.find((detail) => detail.transactionId)?.transactionId;
        return {
          status: "PAID",
          ...(transactionId ? { providerPaymentId: transactionId } : {}),
          ...(typeof order.amount === "number" ? { amountPaise: order.amount } : {}),
        };
      }
      return { status: state === "FAILED" ? "FAILED" : "PENDING" };
    },
  };
}
