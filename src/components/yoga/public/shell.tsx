"use client";
import { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Menu, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

export function PublicShell({ children }: { children: ReactNode }) {
  const { openAuth, setView } = useApp();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <button
            onClick={() => setView("landing")}
            className="flex items-center gap-2 group"
          >
            <span className="grid place-items-center h-9 w-9 rounded-full bg-brand-gradient text-primary-foreground shadow-sm group-hover:scale-105 transition">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Prana <span className="text-brand-gradient">Live Yoga</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => setView("landing")} className="hover:text-foreground transition">
              Home
            </button>
            <a href="#features" className="hover:text-foreground transition">
              Features
            </a>
            <a href="#how" className="hover:text-foreground transition">
              How it works
            </a>
            <a href="#pricing" className="hover:text-foreground transition">
              Pricing
            </a>
            <a href="#faq" className="hover:text-foreground transition">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="h-5 w-5 hidden dark:block" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => openAuth("login")}
            >
              Log in
            </Button>
            <Button
              size="sm"
              className="bg-brand-gradient text-primary-foreground hover:opacity-90"
              onClick={() => openAuth("register")}
            >
              Get started
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openAuth("login")}>
                  Log in
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAuth("register")}>
                  Get started
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  Toggle theme
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-border/60 bg-secondary/30">
        <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-brand-gradient text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="font-semibold">Prana Live Yoga</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Daily live classes, fresh Google Meet every morning, and a gentle
              WhatsApp reminder 15 minutes before class.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#features">Features</Link></li>
              <li><Link href="#pricing">Pricing</Link></li>
              <li><Link href="#how">How it works</Link></li>
              <li><Link href="#faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">For business</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Instructors</li>
              <li>Admins</li>
              <li>Automation &amp; webhooks</li>
              <li>Razorpay subscriptions</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>support@pranayoga.app</li>
              <li>Mon–Sun, 6 AM–9 PM IST</li>
              <li>Made with 🧘 in India</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Prana Live Yoga. Membership ₹500/month.
          Powered by Google Meet &amp; Meta WhatsApp Business API.
        </div>
      </footer>
    </div>
  );
}
