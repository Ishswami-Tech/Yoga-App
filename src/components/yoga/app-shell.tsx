"use client";
import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp, View, SessionUser } from "@/lib/store";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import { authClient } from "@/lib/better-auth-client";
import { Moon, Sun, LogOut, ChevronDown, User as UserIcon } from "lucide-react";
import { Mandala } from "@/components/yoga/art/sunrise";
import { BrandLogo } from "@/components/yoga/brand-logo";
import { useTheme } from "next-themes";
import { usePlan } from "@/hooks/use-plan";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/yoga/admin/notifications-bell";

import { APP_NAME } from "@/lib/brand";
export type NavItem = {
  view: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
};

export function AppShell({
  brand,
  navItems,
  children,
  role,
}: {
  brand: string;
  navItems: NavItem[];
  children: ReactNode;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}) {
  const { user, view, setView, set } = useApp();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const plan = usePlan();

  const logoutMut = useMutation({
    mutationFn: async () => {
      // Clear both the Better Auth session and the legacy session cookie.
      await authClient.signOut().catch(() => {});
      return apiPost("/api/auth/logout", {});
    },
    onSuccess: () => {
      set({ user: null, membership: null, view: "landing" });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Signed out");
      window.location.hash = "";
      window.location.reload();
    },
  });

  if (!user) return null;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-secondary/90 backdrop-blur shadow-[0_6px_20px_-12px_rgb(59_31_26/0.35)]">
        <div className="flex h-16 px-3 sm:px-4 items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <BrandLogo size={46} className="shrink-0" priority />
            <div className="min-w-0">
              <p className="font-display text-sm sm:text-lg leading-tight font-semibold tracking-tight line-clamp-2 sm:truncate">
                {APP_NAME}
              </p>
              <p className="hidden sm:block text-xs font-semibold text-muted-foreground">
                {role === "ADMIN"
                  ? "Admin console"
                  : role === "INSTRUCTOR"
                  ? "Instructor workspace"
                  : "Student portal"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0 sm:gap-2">
            {role === "ADMIN" && <NotificationsBell />}
            <Button
              variant="ghost"
              size="icon"
              className="size-10 sm:size-11"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="h-5 w-5 hidden dark:block" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1 px-1.5 sm:gap-2 sm:px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-accent text-foreground text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium max-w-[140px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </span>
                    <span className="mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {role}
                      </Badge>
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role === "STUDENT" && (
                  <DropdownMenuItem onClick={() => setView("student-profile")}>
                    <UserIcon className="h-4 w-4" /> Profile
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-4 w-4" /> Light mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" /> Dark mode
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logoutMut.mutate()}
                  className="text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 bg-card/70 flex-col">
          <nav className="p-3 space-y-1 flex-1">
            {navItems.map((item) => {
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={`w-full min-h-11 flex items-center gap-3 rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-[#F5A623] text-[#3B1F1A] font-bold shadow-soft"
                      : "text-foreground/80 font-semibold hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <Badge variant="secondary" className="text-[10px]">
                      {item.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="p-3">
            <div className="relative overflow-hidden rounded-2xl bg-secondary p-3 text-xs text-foreground/80">
              <Mandala size={80} className="pointer-events-none absolute -right-6 -top-6 opacity-70" />
              <p className="font-medium text-foreground mb-1">{APP_NAME}</p>
              <p>Live online classes · {plan.display}/month</p>
            </div>
          </div>
        </aside>

        {/* Mobile bottom nav */}
        <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-30 rounded-t-[1.75rem] bg-card/95 backdrop-blur shadow-[0_-8px_24px_-10px_rgb(59_31_26/0.2)]">
          <div className="flex overflow-x-auto scroll-soft">
            {navItems.map((item) => {
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  aria-current={active ? "page" : undefined}
                  className={`flex-1 min-w-[68px] min-h-[56px] flex flex-col items-center justify-center gap-0.5 py-1.5 text-xs ${
                    active
                      ? "text-foreground font-extrabold"
                      : "text-muted-foreground font-bold"
                  }`}
                >
                  <span className={`flex h-7 w-14 items-center justify-center rounded-full ${active ? "bg-[#F5A623] text-[#3B1F1A]" : ""}`}>
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="truncate max-w-[64px]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          <div className="container mx-auto px-4 py-6 max-w-6xl">{children}</div>
        </main>
      </div>

      <footer className="md:hidden text-center text-[10px] text-muted-foreground py-2 border-t border-border/40 bg-secondary/20">
        {APP_NAME} · {plan.display}/month
      </footer>
    </div>
  );
}

// Helper hook used by role apps to keep user/membership fresh.
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiGet<{ user: SessionUser; membership: any }>("/api/auth/me"),
    refetchInterval: 30 * 1000,
  });
}
