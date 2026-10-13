"use client";
import { APP_NAME } from "@/lib/brand";
import { usePlan } from "@/hooks/use-plan";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LotusMark, Mandala } from "@/components/yoga/art/sunrise";
import { Loader2, MessageCircle, ArrowRight, ArrowLeft } from "lucide-react";

type Step = "number" | "code";
const RESEND_SECONDS = 30;

export function AuthModal() {
  const plan = usePlan();
  const { authOpen, closeAuth, set, setView } = useApp();
  const [mode, setMode] = useState<"login" | "register">(authOpen === "register" ? "register" : "login");
  const [step, setStep] = useState<Step>("number");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const digits = number.replace(/\D/g, "");
  const phone = `+91${digits}`;
  const registering = mode === "register";
  const numberValid = digits.length === 10 && /^[6-9]/.test(digits);
  const canSend = numberValid && (!registering || name.trim().length >= 2);

  const reset = () => {
    setStep("number"); setName(""); setNumber(""); setCode(""); setError(null); setCountdown(0);
  };

  const switchMode = (m: "login" | "register") => { setMode(m); setStep("number"); setCode(""); setError(null); };

  const sendCode = async () => {
    if (!canSend || loading) return;
    setLoading(true); setError(null);
    try {
      await apiPost("/api/auth/otp/send", {
        phone,
        mode,
        ...(registering ? { name: name.trim() } : {}),
      });
      setStep("code"); setCode(""); setCountdown(RESEND_SECONDS);
    } catch (e: any) {
      setError(e?.message || "Couldn't send the code. Please try again.");
    } finally { setLoading(false); }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || loading) return;
    setLoading(true); setError(null);
    try {
      const res = await apiPost("/api/auth/otp/verify", {
        phone,
        code: value,
        mode,
        ...(registering ? { name: name.trim() } : {}),
      });
      const user = res.user;
      set({ user, authOpen: null });
      setView(
        user?.role === "ADMIN" ? "admin-dashboard"
        : user?.role === "INSTRUCTOR" ? "instructor-dashboard"
        : "student-dashboard"
      );
    } catch (e: any) {
      setError(e?.message || "Verification failed. Please try again.");
      setCode("");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={!!authOpen} onOpenChange={(o) => { if (!o) { reset(); closeAuth(); } }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scroll-soft rounded-[2rem] bg-card border-0 shadow-lift">
        <Mandala size={150} className="pointer-events-none absolute -right-12 -top-12 opacity-70" />
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <LotusMark size={36} />
            <DialogTitle className="font-display text-2xl font-semibold">{APP_NAME}</DialogTitle>
          </div>
          <DialogDescription>
            {step === "number"
              ? registering
                ? `Create your account · ${plan.display}/month · Cancel anytime`
                : "Sign in with a one-time code sent to your WhatsApp"
              : `Enter the 6-digit code we sent to +91 ${digits} on WhatsApp`}
          </DialogDescription>
        </DialogHeader>

        {step === "number" && (
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); sendCode(); }}
          >
            {registering && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name" className="text-xs">Full name</Label>
                <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={80} autoFocus />
              </div>
            )}
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
                  autoFocus={!registering}
                />
              </div>
              <p id="auth-phone-hint" className="text-[11px] text-muted-foreground">
                We&apos;ll send a code on WhatsApp. Class links and reminders go to this number too.
              </p>
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || !canSend}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageCircle className="h-4 w-4" /> Send code on WhatsApp</>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {registering ? "Already a member?" : "New here?"}{" "}
              <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => switchMode(registering ? "login" : "register")}>
                {registering ? "Sign in" : "Create an account"}
              </button>
            </p>
          </form>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <button type="button" onClick={() => { setStep("number"); setCode(""); setError(null); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="h-3 w-3" /> Change number
            </button>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => { setCode(v.replace(/\D/g, "")); if (error) setError(null); }}
                onComplete={verify}
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
            <Button className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || code.length !== 6} onClick={() => verify(code)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify &amp; continue <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              {countdown > 0 ? (
                <>Resend code in {countdown}s</>
              ) : (
                <button type="button" className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50" disabled={loading} onClick={sendCode}>
                  Resend code
                </button>
              )}
            </p>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground">
          By continuing you agree to our Terms of Service and Privacy Policy. Standard WhatsApp rules apply.
        </p>
      </DialogContent>
    </Dialog>
  );
}
