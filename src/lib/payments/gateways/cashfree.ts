import type { CreatedGatewayOrder, FetchLike, Gateway, GatewayEnv, GatewayStatus, OrderRequest } from "../types";
import { requestJson } from "./http";

const API_VERSION = "2025-01-01";
const SANDBOX_BASE = "https://sandbox.cashfree.com/pg";
const PRODUCTION_BASE = "https://api.cashfree.com/pg";
// Cashfree requires a syntactically valid 10-digit phone; used when the student has none on file.
const FALLBACK_PHONE = "9999999999";

interface CashfreeOrderResponse {
  order_id?: string;
  payment_session_id?: string;
  order_status?: string;
  order_amount?: number;
}

interface CashfreePayment {
  cf_payment_id?: string | number;
  payment_status?: string;
}

function toPhone(raw: string | undefined): string {
  const digits = (raw ?? "").replace(/\D/gu, "");
  const last10 = digits.slice(-10);
  return last10.length === 10 ? last10 : FALLBACK_PHONE;
}

export function createCashfreeGateway(env: GatewayEnv, fetchImpl: FetchLike = fetch): Gateway | null {
  const appId = env.CASHFREE_APP_ID?.trim();
  const secretKey = env.CASHFREE_SECRET_KEY?.trim();
  if (!appId || !secretKey) {
    return null;
  }
  const base = env.CASHFREE_ENVIRONMENT?.trim().toLowerCase() === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
  const headers = {
    "Content-Type": "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": appId,
    "x-client-secret": secretKey,
  };

  return {
    name: "cashfree",

    async createOrder(request: OrderRequest): Promise<CreatedGatewayOrder> {
      const orderMeta: Record<string, string> = { return_url: request.returnUrl };
      if (request.notifyUrl) {
        orderMeta.notify_url = request.notifyUrl;
      }
      const order = await requestJson<CashfreeOrderResponse>("Cashfree", fetchImpl, `${base}/orders`, {
        method: "POST",
        headers: { ...headers, "x-idempotency-key": request.localOrderId },
        body: JSON.stringify({
          order_id: request.localOrderId,
          order_amount: Number((request.amountPaise / 100).toFixed(2)),
          order_currency: request.currency,
          order_note: request.description,
          customer_details: {
            customer_id: request.customer.id,
            customer_name: request.customer.name,
            customer_email: request.customer.email,
            customer_phone: toPhone(request.customer.phone),
          },
          order_meta: orderMeta,
        }),
      });
      if (!order.order_id || !order.payment_session_id) {
        throw new Error("Cashfree did not return an order id and payment session");
      }
      return { providerOrderId: order.order_id, checkout: { paymentSessionId: order.payment_session_id } };
    },

    async fetchStatus(providerOrderId: string): Promise<GatewayStatus> {
      const id = encodeURIComponent(providerOrderId);
      const order = await requestJson<CashfreeOrderResponse>("Cashfree", fetchImpl, `${base}/orders/${id}`, {
        method: "GET",
        headers,
      });
      const orderStatus = (order.order_status ?? "").toUpperCase();
      if (orderStatus === "EXPIRED" || orderStatus === "TERMINATED" || orderStatus === "TERMINATION_REQUESTED") {
        return { status: "FAILED" };
      }
      if (orderStatus !== "PAID") {
        return { status: "PENDING" };
      }

      const payments = await requestJson<CashfreePayment[]>("Cashfree", fetchImpl, `${base}/orders/${id}/payments`, {
        method: "GET",
        headers,
      });
      const success = Array.isArray(payments)
        ? payments.find((payment) => payment.payment_status === "SUCCESS")
        : undefined;
      return {
        status: "PAID",
        ...(success?.cf_payment_id !== undefined ? { providerPaymentId: String(success.cf_payment_id) } : {}),
        ...(typeof order.order_amount === "number" ? { amountPaise: Math.round(order.order_amount * 100) } : {}),
      };
    },
  };
}
