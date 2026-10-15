"use client";
import { usePlan } from "@/hooks/use-plan";
import { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Menu } from "lucide-react";
import { HillBand } from "@/components/yoga/art/sunrise";
import { BrandLogo } from "@/components/yoga/brand-logo";
import { useTheme } from "next-themes";
import Link from "next/link";

import { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/brand";
export function PublicShell({ children }: { children: ReactNode }) {
  const plan = usePlan();
  const { openAuth, setView } = useApp();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full bg-secondary/90 backdrop-blur supports-[backdrop-filter]:bg-secondary/80 shadow-[0_6px_20px_-12px_rgb(59_31_26/0.35)]">
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:px-4">
          <button
            onClick={() => setView("landing")}
            className="flex min-w-0 items-center gap-2 sm:gap-3 group min-h-11"
            aria-label={`${APP_NAME} home`}
          >
            <BrandLogo size={46} className="shrink-0 group-hover:scale-105 transition" priority />
            <span className="min-w-0 font-display text-sm leading-tight sm:text-2xl font-semibold tracking-tight text-left">
              <span className="text-brand-gradient">{APP_NAME}</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-[15px] font-bold text-foreground">
            <button onClick={() => setView("landing")} className="inline-flex min-h-11 items-center px-1 hover:text-primary transition">
              Home
            </button>
            <a href="#features" className="inline-flex min-h-11 items-center px-1 hover:text-primary transition">
              Features
            </a>
            <a href="#how" className="inline-flex min-h-11 items-center px-1 hover:text-primary transition">
              How it works
            </a>
            <a href="#pricing" className="inline-flex min-h-11 items-center px-1 hover:text-primary transition">
              Pricing
            </a>
            <a href="#faq" className="inline-flex min-h-11 items-center px-1 hover:text-primary transition">
              FAQ
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
              className="bg-primary text-primary-foreground hover:opacity-90 px-6 h-11"
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

      <HillBand base="#3B1F1A" className="mt-10 -mb-px" />
      <footer className="mt-auto bg-[#3B1F1A] text-[#FFF4E0]">
        <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BrandLogo size={48} plate />
              <span className="font-display text-xl font-semibold">{APP_NAME}</span>
            </div>
            <p className="text-sm text-[#FFE4C4]">
              Daily live classes, fresh Google Meet every morning, and a gentle
              WhatsApp reminder 15 minutes before class.
            </p>
          </div>
          <div>
            <h4 className="font-display text-base font-semibold mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-[#FFE4C4]">
              <li><Link href="#features">Features</Link></li>
              <li><Link href="#pricing">Pricing</Link></li>
              <li><Link href="#how">How it works</Link></li>
              <li><Link href="#faq">FAQ</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><Link href="/terms">Terms &amp; Conditions</Link></li>
              <li><Link href="/refund-policy">Cancellation &amp; Refund Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-base font-semibold mb-3">For business</h4>
            <ul className="space-y-2 text-sm text-[#FFE4C4]">
              <li>Instructors</li>
              <li>Admins</li>
              <li>Automation &amp; webhooks</li>
              <li>Razorpay subscriptions</li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-base font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-[#FFE4C4]">
              {SUPPORT_EMAIL && <li>{SUPPORT_EMAIL}</li>}
              {SUPPORT_PHONE && <li>{SUPPORT_PHONE}</li>}
              <li>Mon–Sun, 6 AM–9 PM IST</li>
              <li>Made with 🧘 in India</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#FFF4E0]/20 py-4 text-center text-xs text-[#FFE4C4]">
          © {new Date().getFullYear()} {APP_NAME}. Membership {plan.display}/month.
          Powered by Google Meet &amp; Meta WhatsApp Business API.
        </div>
      </footer>
    </div>
  );
}
