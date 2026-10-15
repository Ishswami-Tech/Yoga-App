"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeStep } from "@/components/yoga/public/auth/code-step";
import { useCodeFlow } from "@/components/yoga/public/auth/use-code-flow";
import type { SessionUser } from "@/lib/store";
import { Loader2, CheckCircle2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  /** Set once the address has been proven; the step then shows it read-only. */
  verifiedEmail: string | null;
  onVerified: (user: SessionUser) => void;
};

/**
 * Profile-completion email step: enter address, Send code, enter the 6-digit code, Verify.
 * The server stores the address only after the code is proven (POST /api/profile/email/*).
 * Not a form element, so it can sit inside the dialog without nesting forms.
 */
export function ProfileEmailStep({ verifiedEmail, onVerified }: Props) {
  const [email, setEmail] = useState("");
  const trimmed = email.trim();
  const flow = useCodeFlow({
    sendUrl: "/api/profile/email/send",
    verifyUrl: "/api/profile/email/verify",
    body: (code) => (code ? { email: trimmed, code } : { email: trimmed }),
    canSend: EMAIL_RE.test(trimmed),
    onUser: onVerified,
  });

  if (verifiedEmail) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="profile-email-verified" className="text-xs">Email</Label>
        <div className="relative">
          <Input id="profile-email-verified" value={verifiedEmail} readOnly disabled className="pr-9" />
          <CheckCircle2 aria-label="Verified" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
        </div>
        <p className="text-[11px] text-emerald-700">Email verified</p>
      </div>
    );
  }

  if (flow.step === "code") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Enter the 6-digit code we emailed to <span className="font-medium text-foreground">{trimmed}</span>.
        </p>
        <CodeStep
          code={flow.code}
          onCodeChange={flow.changeCode}
          onVerify={flow.verify}
          onResend={flow.send}
          onBack={flow.back}
          backLabel="Use a different email"
          countdown={flow.countdown}
          loading={flow.loading}
          error={flow.error}
          submitLabel="Verify email"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="profile-email" className="text-xs">Email</Label>
      <div className="flex gap-2">
        <Input
          id="profile-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void flow.send(); } }}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <Button
          type="button"
          variant="outline"
          disabled={flow.loading || !EMAIL_RE.test(trimmed)}
          onClick={() => void flow.send()}
        >
          {flow.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
        </Button>
      </div>
      {flow.error && <p role="alert" className="text-xs text-destructive">{flow.error}</p>}
      <p className="text-[11px] text-muted-foreground">We will email you a code to confirm this address.</p>
    </div>
  );
}
