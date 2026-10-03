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
import { Moon, Sun, LogOut, ChevronDown, User as UserIcon, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/yoga/admin/notifications-bell";

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

  const logoutMut = useMutation({
    mutationFn: () => apiPost("/api/auth/logout", {}),
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
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="flex h-16 px-4 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-brand-gradient text-primary-foreground shadow-sm shrink-0">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight truncate">
                {brand}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {role === "ADMIN"
                  ? "Admin console"
                  : role === "INSTRUCTOR"
                  ? "Instructor workspace"
                  : "Student portal"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {role === "ADMIN" && <NotificationsBell />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="h-5 w-5 hidden dark:block" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
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
        <aside className="hidden md:flex w-60 shrink-0 border-r border-border/60 bg-secondary/20 flex-col">
          <nav className="p-3 space-y-1 flex-1">
            {navItems.map((item) => {
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
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
            <div className="rounded-lg bg-brand-gradient/10 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Prana Live Yoga</p>
              <p>Daily 7:00 AM IST · ₹500/month</p>
            </div>
          </div>
        </aside>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur">
          <div className="flex overflow-x-auto scroll-soft">
            {navItems.map((item) => {
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={`flex-1 min-w-[64px] flex flex-col items-center gap-1 py-2 text-[10px] ${
                    active
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="truncate max-w-[60px]">{item.label}</span>
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
        Prana Live Yoga · ₹500/month
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
