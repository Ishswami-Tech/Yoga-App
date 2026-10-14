"use client";
import { APP_NAME } from "@/lib/brand";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp, type SessionUser } from "@/lib/store";
import { apiGet } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mandala } from "@/components/yoga/art/sunrise";
import { BrandLogo } from "@/components/yoga/brand-logo";
import { MethodTabs, type Method } from "./auth/method-tabs";
import { PhoneForm } from "./auth/phone-form";
import { EmailForm } from "./auth/email-form";
import { GoogleButton } from "./auth/google-button";

type AuthMethods = { phone: boolean; email: boolean; google: boolean };

export function AuthModal() {
  const { authOpen, closeAuth, set, setView } = useApp();
  const [method, setMethod] = useState<Method>("phone");
  const open = !!authOpen;

  const { data: methods } = useQuery({
    queryKey: ["auth-methods"],
    queryFn: () => apiGet<AuthMethods>("/api/auth/methods"),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const emailEnabled = methods?.email === true;
  const googleEnabled = methods?.google === true;
  const activeMethod: Method = method === "email" && emailEnabled ? "email" : "phone";

  const onUser = (user: SessionUser) => {
    set({ user, authOpen: null });
    // A brand-new student must finish the profile dialog first (rendered by the page).
    if (user?.role === "STUDENT" && user.profileCompleted === false) return;
    setView(
      user?.role === "ADMIN" ? "admin-dashboard"
      : user?.role === "INSTRUCTOR" ? "instructor-dashboard"
      : "student-dashboard"
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setMethod("phone"); closeAuth(); } }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scroll-soft rounded-[2rem] bg-card border-0 shadow-lift">
        <Mandala size={150} className="pointer-events-none absolute -right-12 -top-12 opacity-70" />
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <BrandLogo size={56} />
            <DialogTitle className="font-display text-2xl font-semibold">{APP_NAME}</DialogTitle>
          </div>
          <DialogDescription>Sign in or sign up to continue.</DialogDescription>
        </DialogHeader>

        <MethodTabs value={activeMethod} onChange={setMethod} emailEnabled={emailEnabled} />

        {/* key remounts the form so each tab starts from a clean state */}
        {activeMethod === "phone"
          ? <PhoneForm key="phone" onUser={onUser} />
          : <EmailForm key="email" onUser={onUser} />}

        {googleEnabled && (
          <>
            <div className="flex items-center gap-3" role="separator">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <GoogleButton />
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">New here? We&apos;ll create your account for you.</p>
        <p className="text-center text-[10px] text-muted-foreground">
          By continuing you agree to our Terms of Service and Privacy Policy. Standard WhatsApp rules apply.
        </p>
      </DialogContent>
    </Dialog>
  );
}
