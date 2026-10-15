"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp, type SessionUser } from "@/lib/store";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandLogo } from "@/components/yoga/brand-logo";
import { ProfilePhoneStep } from "@/components/yoga/profile-phone-step";
import { ProfileEmailStep } from "@/components/yoga/profile-email-step";
import { needsEmailVerification } from "@/lib/email-otp-config";
import { Loader2 } from "lucide-react";

const PLACEHOLDER_NAME = "New student";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Blocking dialog shown to a signed-in STUDENT whose profile is not complete.
 * Step 1: name (+ email when it is a placeholder). Step 2 (only when the phone
 * is not yet verified): WhatsApp verification. Then terms and Finish.
 * It cannot be dismissed.
 */
export function ProfileCompletionDialog() {
  const { user, view, set, setView } = useApp();
  const queryClient = useQueryClient();
  // Fixed at mount so the step list does not change once the phone is verified.
  const [needsPhone] = useState(user?.phoneVerified === false);
  const { data: methods } = useQuery({
    queryKey: ["auth-methods"],
    queryFn: () => apiGet<{ email: boolean }>("/api/auth/methods"),
    staleTime: 5 * 60 * 1000,
  });
  const methodsLoading = methods === undefined;
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  // Code-verified flow (email delivery configured) vs the simple unverified field (fallback).
  const verifyFlow =
    verifiedEmail !== null || (user ? needsEmailVerification(user, methods?.email === true) : false);
  const needsEmailClaim = user?.emailIsPlaceholder === true && !verifyFlow && !methodsLoading;
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(
    user?.name && user.name.trim() !== PLACEHOLDER_NAME ? user.name : ""
  );
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDone = user?.phoneVerified !== false;
  const totalSteps = needsPhone ? 2 : 1;
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const detailsValid =
    trimmedName.length >= 2 && trimmedName.length <= 80 &&
    (verifyFlow
      ? verifiedEmail !== null
      : user?.emailIsPlaceholder === true
        ? !methodsLoading && EMAIL_RE.test(trimmedEmail)
        : true);
  const showFinish = !needsPhone || (step === 2 && phoneDone);

  const submit = async () => {
    if (!detailsValid || !accepted || !phoneDone || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<{ user: Partial<SessionUser> }>("/api/profile/complete", {
        name: trimmedName,
        ...(needsEmailClaim ? { email: trimmedEmail } : {}),
        acceptTerms: true,
      });
      set({ user: { ...user!, ...res.user, profileCompleted: true } });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      if (!view.startsWith("student-")) setView("student-dashboard");
    } catch (e) {
      if (e instanceof ApiError && e.code === "PHONE_REQUIRED") {
        setStep(2);
        setError("Please verify your WhatsApp number first.");
      } else if (e instanceof ApiError && e.code === "EMAIL_REQUIRED") {
        setStep(1);
        setError("Please verify your email address first.");
      } else if (e instanceof ApiError && e.code === "EMAIL_TAKEN") {
        setStep(1);
        setError("That email is already used by another account. Please use a different one.");
      } else {
        setError(e instanceof Error && e.message ? e.message : "Couldn't save your profile. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (!detailsValid) return;
    setError(null);
    setStep(2);
  };

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md max-h-[90vh] overflow-y-auto scroll-soft rounded-[2rem] bg-card border-0 shadow-lift"
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <BrandLogo size={56} />
            <DialogTitle className="font-display text-2xl font-semibold">Complete your profile</DialogTitle>
          </div>
          <DialogDescription>
            {step === 1
              ? "Welcome! Tell us a little about yourself to start using your account."
              : "Verify your WhatsApp number"}
          </DialogDescription>
          {totalSteps > 1 && (
            <p className="text-[11px] font-medium text-muted-foreground" aria-live="polite">
              Step {step} of {totalSteps}
            </p>
          )}
        </DialogHeader>

        {step === 2 && needsPhone && !phoneDone && (
          <ProfilePhoneStep onVerified={(u) => { set({ user: { ...user!, ...u } }); setError(null); }} />
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs">Full name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                autoFocus
              />
            </div>
            {verifyFlow ? (
              <ProfileEmailStep
                verifiedEmail={verifiedEmail}
                onVerified={(u) => {
                  set({ user: { ...user!, ...u } });
                  setVerifiedEmail(u.email);
                  setError(null);
                }}
              />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="text-xs">Email</Label>
                {user?.emailIsPlaceholder === true ? (
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={methodsLoading}
                  />
                ) : (
                  <Input id="profile-email" value={user?.email ?? ""} readOnly disabled />
                )}
              </div>
            )}
          </div>
        )}

        {(step === 1 || (step === 2 && phoneDone)) && (
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (showFinish) submit(); else goNext(); }}
          >
            {step === 2 && phoneDone && (
              <p className="text-sm text-muted-foreground">Your WhatsApp number is verified. One last thing.</p>
            )}

            {showFinish && (
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="profile-terms"
                  checked={accepted}
                  onCheckedChange={(c) => setAccepted(c === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="profile-terms" className="text-xs font-normal leading-snug text-muted-foreground">
                  <span>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>Terms &amp; Conditions</a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                  </span>
                </Label>
              </div>
            )}

            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-brand-gradient text-primary-foreground"
              disabled={loading || !detailsValid || (showFinish && !accepted)}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : showFinish ? "Finish" : "Continue"}
            </Button>
          </form>
        )}

        {step === 2 && needsPhone && !phoneDone && error && (
          <p role="alert" className="text-xs text-destructive">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
