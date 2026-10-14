"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, apiGet, apiPost, ApiError } from "@/lib/api-client";
import { APP_NAME } from "@/lib/brand";

// Razorpay Standard Checkout for Subscriptions.
//
// Flow: create subscription (server) -> open Checkout with subscription_id + public key ->
// handler posts payment id + signature to /api/subscriptions/verify (server verifies the signature
// and re-fetches the subscription from Razorpay) -> poll membership until ACTIVE.
// Membership is never granted from the browser result alone.

export type CheckoutPhase =
  | "idle"
  | "starting" // creating the subscription / loading Checkout
  | "checkout" // Razorpay modal is open
  | "processing" // payment done, confirming with the server
  | "success"
  | "failed"
  | "cancelled" // student closed the Checkout window
  | "unavailable"; // payments not configured (503)

type CreateResp = {
  subscriptionId: string;
  keyId: string;
  amount: number;
  currency: string;
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (resp: any) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

// Same sentence as BRIDGE_PAYMENT_NOTE (bridge.ts is server-only: it uses node:crypto).
const PAYMENT_NOTE = `Payments for ${APP_NAME} are securely processed by Ishswami Tech.`;

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const done = (ok: boolean) => resolve(ok && Boolean(window.Razorpay));
    script.addEventListener("load", () => done(true), { once: true });
    script.addEventListener("error", () => done(false), { once: true });
    if (!existing) {
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export function useRazorpayCheckout(opts: {
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  description: string;
  onActive?: () => void;
}) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  /** True when payment was taken but ACTIVE has not been seen after the polling window. */
  const [slow, setSlow] = useState(false);
  const alive = useRef(true);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const set = useCallback((p: CheckoutPhase, m: string | null = null) => {
    if (!alive.current) return;
    setPhase(p);
    setMessage(m);
  }, []);

  const pollUntilActive = useCallback(async () => {
    // Webhooks can lag a little; poll for about 90 seconds.
    for (let i = 0; i < 45 && alive.current; i++) {
      try {
        const m = await apiGet<{ state: string }>("/api/subscription");
        if (m.state === "ACTIVE") {
          qc.invalidateQueries({ queryKey: ["subscription"] });
          qc.invalidateQueries({ queryKey: ["me"] });
          qc.invalidateQueries({ queryKey: ["classes"] });
          set("success");
          optsRef.current.onActive?.();
          return;
        }
      } catch {
        // transient; keep polling
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (alive.current) {
      setSlow(true);
      qc.invalidateQueries({ queryKey: ["subscription"] });
    }
  }, [qc, set]);

  const handleSuccess = useCallback(
    async (resp: RazorpaySuccess) => {
      set("processing");
      setSlow(false);
      try {
        const res = await apiPost<{ verified: boolean }>("/api/subscriptions/verify", {
          razorpaySubscriptionId: resp.razorpay_subscription_id,
          razorpayPaymentId: resp.razorpay_payment_id,
          razorpaySignature: resp.razorpay_signature,
        });
        if (!res.verified) {
          set("failed", "We could not verify this payment. If money was deducted it will be refunded automatically.");
          return;
        }
      } catch (e) {
        // Verification call failed, but the webhook may still activate the membership.
        if (e instanceof ApiError && e.status === 503) {
          set("unavailable");
          return;
        }
      }
      await pollUntilActive();
    },
    [pollUntilActive, set]
  );

  const start = useCallback(async () => {
    set("starting");
    setSlow(false);

    // Preferred path: hand off to the Ishswami payment bridge. The student pays there and is sent
    // back with ?paymentStatus=..., after which the membership view polls until ACTIVE.
    try {
      const { bridgeUrl } = await api<{ bridgeUrl: string }>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ provider: "razorpay", billing: "RECURRING" }),
      });
      window.location.assign(bridgeUrl);
      return;
    } catch (e) {
      const bridgeUnavailable =
        e instanceof ApiError &&
        (e.status === 404 || e.code === "BRIDGE_NOT_CONFIGURED" || e.code === "RECURRING_UNSUPPORTED");
      if (!bridgeUnavailable) {
        return set("failed", e instanceof Error ? e.message : "Could not start checkout");
      }
      // Bridge not set up in this environment: fall back to the embedded Razorpay modal.
    }

    let created: CreateResp;
    try {
      created = await api<CreateResp>("/api/subscriptions/create", { method: "POST", body: "{}" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) return set("unavailable");
      return set("failed", e instanceof Error ? e.message : "Could not start checkout");
    }
    if (!(await loadCheckoutScript()) || !window.Razorpay) {
      return set("failed", "Could not load the payment window. Check your connection and try again.");
    }
    const user = optsRef.current.user;
    const rzp = new window.Razorpay({
      key: created.keyId,
      subscription_id: created.subscriptionId,
      name: APP_NAME,
      description: `${optsRef.current.description} - ${PAYMENT_NOTE}`,
      image: `${window.location.origin}/logo-mark.png`,
      prefill: {
        name: user?.name ?? undefined,
        email: user?.email ?? undefined,
        contact: user?.phone ?? undefined,
      },
      theme: { color: "#E8792B" },
      handler: (resp: RazorpaySuccess) => {
        void handleSuccess(resp);
      },
      modal: {
        ondismiss: () => {
          // Only treat as cancelled if no payment result has started processing.
          if (alive.current) setPhase((p) => (p === "checkout" ? "cancelled" : p));
        },
      },
    });
    rzp.on("payment.failed", (r: any) => {
      set("failed", r?.error?.description ?? "The payment failed. You have not been charged.");
    });
    set("checkout");
    rzp.open();
  }, [handleSuccess, set]);

  const reset = useCallback(() => {
    setSlow(false);
    set("idle");
  }, [set]);

  return { phase, message, slow, start, reset, pollUntilActive };
}
