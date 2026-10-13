import type { CreatedGatewayOrder, FetchLike, Gateway, GatewayEnv, GatewayStatus, OrderRequest } from "../types";
import { requestJson } from "./http";

const API_BASE = "https://api.razorpay.com/v1";

interface RazorpayOrderResponse {
  id?: string;
}

interface RazorpayPaymentsResponse {
  items?: Array<{ id?: string; status?: string; amount?: number }>;
}

export function createRazorpayGateway(env: GatewayEnv, fetchImpl: FetchLike = fetch): Gateway | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    return null;
  }
  const authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  const headers = { Authorization: authorization, "Content-Type": "application/json" };

  return {
    name: "razorpay",

    async createOrder(request: OrderRequest): Promise<CreatedGatewayOrder> {
      const order = await requestJson<RazorpayOrderResponse>("Razorpay", fetchImpl, `${API_BASE}/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: request.amountPaise,
          currency: request.currency,
          receipt: request.localOrderId,
          notes: { paymentOrderId: request.localOrderId, userId: request.customer.id },
        }),
      });
      if (!order.id) {
        throw new Error("Razorpay did not return an order id");
      }
      return { providerOrderId: order.id, checkout: { razorpayKeyId: keyId } };
    },

    async fetchStatus(providerOrderId: string): Promise<GatewayStatus> {
      const payments = await requestJson<RazorpayPaymentsResponse>(
        "Razorpay",
        fetchImpl,
        `${API_BASE}/orders/${encodeURIComponent(providerOrderId)}/payments`,
        { method: "GET", headers },
      );
      const captured = payments.items?.find((item) => item.status === "captured");
      if (!captured?.id) {
        return { status: "PENDING" };
      }
      return {
        status: "PAID",
        providerPaymentId: captured.id,
        ...(typeof captured.amount === "number" ? { amountPaise: captured.amount } : {}),
      };
    },
  };
}
