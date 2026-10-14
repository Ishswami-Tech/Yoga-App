"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle } from "lucide-react";
import type { SessionUser } from "@/lib/store";
import { CodeStep } from "./code-step";
import { useCodeFlow } from "./use-code-flow";

/** WhatsApp number -> 6-digit code. */
export function PhoneForm({ onUser }: { onUser: (user: SessionUser) => void }) {
  const [number, setNumber] = useState("");
  const digits = number.replace(/\D/g, "");
  const phone = `+91${digits}`;
  const canSend = digits.length === 10 && /^[6-9]/.test(digits);

  const flow = useCodeFlow({
    sendUrl: "/api/auth/otp/send",
    verifyUrl: "/api/auth/otp/verify",
    body: (code) => (code ? { phone, code } : { phone }),
    canSend,
    onUser,
  });

  if (flow.step === "code") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Enter the 6-digit code we sent to +91 {digits} on WhatsApp</p>
        <CodeStep
          code={flow.code}
          onCodeChange={flow.changeCode}
          onVerify={flow.verify}
          onResend={flow.send}
          onBack={flow.back}
          backLabel="Change number"
          countdown={flow.countdown}
          loading={flow.loading}
          error={flow.error}
        />
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); flow.send(); }}>
      <div className="space-y-1.5">
        <Label htmlFor="auth-phone" className="text-xs">WhatsApp number</Label>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground" aria-hidden="true">+91</span>
          <Input
            id="auth-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="98765 43210"
            aria-describedby="auth-phone-hint"
            autoFocus
          />
        </div>
        <p id="auth-phone-hint" className="text-[11px] text-muted-foreground">
          We&apos;ll send a 6-digit login code on WhatsApp
        </p>
      </div>
      {flow.error && <p role="alert" className="text-xs text-destructive">{flow.error}</p>}
      <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={flow.loading || !canSend}>
        {flow.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageCircle className="h-4 w-4" /> Send code on WhatsApp</>}
      </Button>
    </form>
  );
}
