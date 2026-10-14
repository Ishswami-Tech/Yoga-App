"use client";
import { useEffect, useState } from "react";
import { apiPost, ApiError } from "@/lib/api-client";
import type { SessionUser } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeStep, RESEND_SECONDS } from "@/components/yoga/public/auth/code-step";
import { Loader2, MessageCircle } from "lucide-react";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError || e instanceof Error ? e.message || fallback : fallback;

/** Links and verifies a WhatsApp number for the signed-in user. */
export function ProfilePhoneStep({ onVerified }: { onVerified: (user: Partial<SessionUser>) => void }) {
  const [number, setNumber] = useState("");
  const [step, setStep] = useState<"number" | "code">("number");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const digits = number.replace(/\D/g, "");
  const phone = `+91${digits}`;
  const canSend = digits.length === 10 && /^[6-9]/.test(digits);

  const send = async () => {
    if (!canSend || loading) return;
    setLoading(true); setError(null);
    try {
      await apiPost("/api/profile/phone/send", { phone });
      setStep("code"); setCode(""); setCountdown(RESEND_SECONDS);
    } catch (e) {
      // PHONE_TAKEN and other errors carry a user-friendly message from the API.
      setError(msg(e, "Couldn't send the code. Please try again."));
    } finally { setLoading(false); }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || loading) return;
    setLoading(true); setError(null);
    try {
      const res = await apiPost<{ user: SessionUser }>("/api/profile/phone/verify", { phone, code: value });
      onVerified({ ...res.user, phoneVerified: true });
    } catch (e) {
      setError(msg(e, "Verification failed. Please try again."));
      setCode("");
    } finally { setLoading(false); }
  };

  if (step === "code") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Enter the 6-digit code we sent to +91 {digits} on WhatsApp</p>
        <CodeStep
          code={code}
          onCodeChange={(v) => { setCode(v); if (error) setError(null); }}
          onVerify={verify}
          onResend={send}
          onBack={() => { setStep("number"); setCode(""); setError(null); }}
          backLabel="Change number"
          countdown={countdown}
          loading={loading}
          error={error}
          submitLabel="Verify number"
        />
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <p className="text-sm text-muted-foreground">
        Every account needs a verified WhatsApp number. Class links and reminders go here.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="profile-phone" className="text-xs">WhatsApp number</Label>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground" aria-hidden="true">+91</span>
          <Input
            id="profile-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="98765 43210"
            autoFocus
          />
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || !canSend}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageCircle className="h-4 w-4" /> Send code on WhatsApp</>}
      </Button>
    </form>
  );
}
