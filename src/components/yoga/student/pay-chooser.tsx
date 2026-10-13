"use client";
import { usePlan } from "@/hooks/use-plan";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type GatewayName = "razorpay" | "cashfree" | "phonepe";
export type BillingType = "ONE_TIME" | "RECURRING";

export type CheckoutOptions = {
  bridgeConfigured: boolean;
  gateways: GatewayName[];
  recurringAvailable: boolean;
};

const GATEWAY_LABELS: Record<GatewayName, { title: string; hint: string }> = {
  razorpay: { title: "Razorpay", hint: "UPI, cards, netbanking, wallets" },
  cashfree: { title: "Cashfree", hint: "UPI, cards, netbanking" },
  phonepe: { title: "PhonePe", hint: "PhonePe, UPI, cards" },
};

function choiceClass(selected: boolean, disabled = false): string {
  const base = "w-full rounded-lg border p-3 text-left text-sm transition-colors";
  if (disabled) return `${base} cursor-not-allowed border-border bg-muted/40 opacity-60`;
  return selected
    ? `${base} border-primary bg-primary/5`
    : `${base} border-border bg-card hover:bg-secondary/40`;
}

export function PayChooser({
  options,
  loading,
  onPay,
  onBack,
}: {
  options: CheckoutOptions;
  loading: boolean;
  onPay: (choice: { provider: GatewayName; billing: BillingType }) => void;
  onBack: () => void;
}) {
  const plan = usePlan();
  const [provider, setProvider] = useState<GatewayName>(options.gateways[0]);
  const [billing, setBilling] = useState<BillingType>("ONE_TIME");

  // Autopay is a Razorpay Subscriptions feature.
  const recurringAllowed = options.recurringAvailable && provider === "razorpay";
  const effectiveBilling: BillingType = recurringAllowed ? billing : "ONE_TIME";

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-lg">Choose how to pay</h2>
          <p className="text-sm text-muted-foreground">
            You&apos;ll complete the payment on our secure payment page and come back here.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment method</p>
          {options.gateways.map((name) => (
            <button
              key={name}
              type="button"
              className={choiceClass(provider === name)}
              onClick={() => setProvider(name)}
            >
              <span className="font-medium">{GATEWAY_LABELS[name].title}</span>
              <span className="block text-xs text-muted-foreground">{GATEWAY_LABELS[name].hint}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
          <button
            type="button"
            className={choiceClass(effectiveBilling === "ONE_TIME")}
            onClick={() => setBilling("ONE_TIME")}
          >
            <span className="font-medium">{plan.display} for 30 days</span>
            <span className="block text-xs text-muted-foreground">One-time payment · no auto-renewal</span>
          </button>
          <button
            type="button"
            disabled={!recurringAllowed}
            className={choiceClass(effectiveBilling === "RECURRING", !recurringAllowed)}
            onClick={() => recurringAllowed && setBilling("RECURRING")}
          >
            <span className="font-medium">{plan.display} every month</span>
            <span className="block text-xs text-muted-foreground">
              {recurringAllowed
                ? "Autopay with Razorpay · cancel anytime"
                : "Autopay is available with Razorpay only"}
            </span>
          </button>
        </div>

        <Button
          className="w-full bg-primary text-primary-foreground"
          disabled={loading}
          onClick={() => onPay({ provider, billing: effectiveBilling })}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Opening secure payment…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Pay {plan.display} securely
            </>
          )}
        </Button>
        <Button variant="ghost" className="w-full" disabled={loading} onClick={onBack}>
          Back
        </Button>
      </CardContent>
    </Card>
  );
}
