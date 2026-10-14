"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp, initViewFromHash, loginViewForRole } from "@/lib/store";
import { apiGet } from "@/lib/api-client";
import { PublicShell } from "@/components/yoga/public/shell";
import { ProfileCompletionDialog } from "@/components/yoga/profile-completion-dialog";
import { AuthModal } from "@/components/yoga/public/auth-modal";
import { Landing } from "@/components/yoga/public/landing";
import { Checkout } from "@/components/yoga/public/checkout";
import { StudentApp } from "@/components/yoga/student/app";
import { InstructorApp } from "@/components/yoga/instructor/app";
import { AdminApp } from "@/components/yoga/admin/app";

export default function Page() {
  const { user, membership, view, set, setView, authOpen } = useApp();

  // Bootstrap session.
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<{ user: any; membership: any }>("/api/auth/me"),
    refetchOnMount: true,
  });

  useEffect(() => {
    if (data) {
      set({ user: data.user ?? null, membership: data.membership ?? null });
      // If user is logged in but on a public view, jump to their home view.
      if (data.user && (view === "landing" || view === "login" || view === "register" || view === "checkout")) {
        setView(loginViewForRole(data.user.role));
      }
    }
  }, [data]);

  // Sync hash changes (back/forward).
  useEffect(() => {
    const onHash = () => setView(initViewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Loading screen while bootstrapping.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-brand-gradient animate-breath" />
          <p className="text-sm text-muted-foreground">Finding your center…</p>
        </div>
      </div>
    );
  }

  // Public views (no auth required).
  if (!user) {
    return (
      <PublicShell>
        {view === "checkout" ? <Checkout /> : <Landing />}
        {authOpen ? <AuthModal /> : null}
      </PublicShell>
    );
  }

  // Authenticated views by role.
  if (user.role === "STUDENT") {
    // New accounts must finish their profile first; show only the blocking dialog over a plain backdrop.
    if (user.profileCompleted === false) {
      return (
        <div className="min-h-screen bg-background">
          <ProfileCompletionDialog />
        </div>
      );
    }
    return <StudentApp />;
  }
  if (user.role === "INSTRUCTOR") {
    return <InstructorApp />;
  }
  return <AdminApp />;
}
