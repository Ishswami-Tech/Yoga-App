"use client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";

export const RESEND_SECONDS = 30;

type Props = {
  code: string;
  onCodeChange: (v: string) => void;
  onVerify: (value: string) => void;
  onResend: () => void;
  onBack: () => void;
  backLabel: string;
  countdown: number;
  loading: boolean;
  error: string | null;
  submitLabel?: string;
};

/** 6-digit code entry with resend countdown, shared by the phone and email flows. */
export function CodeStep({
  code, onCodeChange, onVerify, onResend, onBack, backLabel,
  countdown, loading, error, submitLabel = "Verify & continue",
}: Props) {
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="h-3 w-3" /> {backLabel}
      </button>
      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => onCodeChange(v.replace(/\D/g, ""))}
          onComplete={onVerify}
          disabled={loading}
          inputMode="numeric"
          autoFocus
          aria-label="6-digit code"
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error && <p role="alert" className="text-center text-xs text-destructive">{error}</p>}
      <Button className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || code.length !== 6} onClick={() => onVerify(code)}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{submitLabel} <ArrowRight className="h-4 w-4" /></>}
      </Button>
      <p className="text-center text-xs text-muted-foreground" aria-live="polite">
        {countdown > 0 ? (
          <>Resend code in {countdown}s</>
        ) : (
          <button type="button" className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50" disabled={loading} onClick={onResend}>
            Resend code
          </button>
        )}
      </p>
    </div>
  );
}
