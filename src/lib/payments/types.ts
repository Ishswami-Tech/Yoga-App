// Shared types for the multi-gateway payment layer. Pure types only.

export type GatewayName = "razorpay" | "cashfree" | "phonepe";

export type GatewayEnv = Readonly<Record<string, string | undefined>>;

export type FetchLike = typeof fetch;

export interface OrderRequest {
  /** Our PaymentOrder.id; used as receipt / merchant order id. */
  readonly localOrderId: string;
  /** Amount in paise. */
  readonly amountPaise: number;
  readonly currency: string;
  readonly description: string;
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly phone?: string;
  };
  /** Where the gateway sends the browser after payment (the bridge callback). */
  readonly returnUrl: string;
  /** Public https endpoint for gateway webhooks, when supported. */
  readonly notifyUrl?: string;
}

/** What the bridge needs to open the gateway's checkout. */
export interface GatewayCheckoutData {
  readonly razorpayKeyId?: string;
  readonly paymentSessionId?: string;
  readonly gatewayRedirectUrl?: string;
}

export interface CreatedGatewayOrder {
  /** The id the bridge and the gateway use to refer to this order. */
  readonly providerOrderId: string;
  readonly checkout: GatewayCheckoutData;
}

export interface GatewayStatus {
  readonly status: "PAID" | "PENDING" | "FAILED";
  readonly providerPaymentId?: string;
  readonly amountPaise?: number;
}

export interface Gateway {
  readonly name: GatewayName;
  createOrder(request: OrderRequest): Promise<CreatedGatewayOrder>;
  fetchStatus(providerOrderId: string): Promise<GatewayStatus>;
}
