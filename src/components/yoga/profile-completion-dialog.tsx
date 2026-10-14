"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiPost } from "@/lib/api-client";
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
import { Loader2 } from "lucide-react";

const PLACEHOLDER_NAME = "New student";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Blocking dialog shown to a signed-in STUDENT whose profile is not complete
 * (brand-new accounts only have a phone number). It cannot be dismissed.
 */
export function ProfileCompletionDialog() {
  const { user, view, set, setView } = useApp();
  const queryClient = useQueryClient();
  const [name, setName] = useState(
    user?.name && user.name.trim() !== PLACEHOLDER_NAME ? user.name : ""
  );
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const valid =
    trimmedName.length >= 2 &&
    trimmedName.length <= 80 &&
    EMAIL_RE.test(trimmedEmail) &&
    accepted;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<{ user: any }>("/api/profile/complete", {
        name: trimmedName,
        email: trimmedEmail,
        acceptTerms: true,
      });
      set({ user: { ...user!, ...res.user, profileCompleted: true } });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      if (!view.startsWith("student-")) setView("student-dashboard");
    } catch (e: any) {
      setError(e?.message || "Couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
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
            Welcome! Tell us a little about yourself to start using your account.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
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
          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-xs">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
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
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || !valid}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save and continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
