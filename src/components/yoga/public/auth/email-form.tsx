"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import type { SessionUser } from "@/lib/store";
import { CodeStep } from "./code-step";
import { useCodeFlow } from "./use-code-flow";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email address -> 6-digit code. */
export function EmailForm({ onUser }: { onUser: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const trimmed = email.trim().toLowerCase();
  const canSend = EMAIL_RE.test(trimmed);

  const flow = useCodeFlow({
    sendUrl: "/api/auth/email/send",
    verifyUrl: "/api/auth/email/verify",
    body: (code) => (code ? { email: trimmed, code } : { email: trimmed }),
    canSend,
    onUser,
  });

  if (flow.step === "code") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Enter the 6-digit code we emailed to {trimmed}</p>
        <CodeStep
          code={flow.code}
          onCodeChange={flow.changeCode}
          onVerify={flow.verify}
          onResend={flow.send}
          onBack={flow.back}
          backLabel="Change email"
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
        <Label htmlFor="auth-email" className="text-xs">Email address</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-describedby="auth-email-hint"
          autoFocus
        />
        <p id="auth-email-hint" className="text-[11px] text-muted-foreground">
          We&apos;ll email you a 6-digit login code
        </p>
      </div>
      {flow.error && <p role="alert" className="text-xs text-destructive">{flow.error}</p>}
      <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={flow.loading || !canSend}>
        {flow.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> Send email code</>}
      </Button>
    </form>
  );
}
