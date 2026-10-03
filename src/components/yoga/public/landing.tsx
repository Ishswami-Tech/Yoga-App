"use client";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Badge,
} from "@/components/ui/badge";
import {
  Video,
  MessageCircle,
  CalendarDays,
  ShieldCheck,
  Clock,
  Users,
  Heart,
  Sparkles,
  IndianRupee,
  Check,
  ArrowRight,
  Bell,
  Repeat,
} from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Daily Google Meet classes",
    desc: "A brand-new Meet link is generated for every class day — no stale links, no shared rooms.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp reminder 15 min before",
    desc: "Approved Meta WhatsApp Business template with your name, class time, and the day's join link.",
  },
  {
    icon: CalendarDays,
    title: "Recurring schedule + holidays",
    desc: "Instructor sets the weekly rhythm. No-class dates automatically skip Meet creation and reminders.",
  },
  {
    icon: ShieldCheck,
    title: "Idempotent & access-controlled",
    desc: "Webhook signature verification, idempotent jobs, and active-membership checks before any join link.",
  },
  {
    icon: Clock,
    title: "Asia/Kolkata-native",
    desc: "All scheduling happens in IST. The 15-minute reminder is computed from the class start time, not hard-coded.",
  },
  {
    icon: Users,
    title: "Student, Instructor, Admin",
    desc: "Role-based dashboards. Admins manage schedules, exceptions, payments and WhatsApp logs.",
  },
];

const steps = [
  {
    title: "Register & subscribe",
    desc: "Create your student account. ₹500/month recurring membership via Razorpay Subscriptions.",
  },
  {
    title: "We create today's Meet",
    desc: "The scheduler creates a fresh Google Calendar event with a new Google Meet for each class day.",
  },
  {
    title: "WhatsApp reminder at T-15",
    desc: "Exactly 15 minutes before class start, active members get the join link on WhatsApp.",
  },
  {
    title: "Join & flow",
    desc: "Tap the link, join Google Meet, breathe. No custom video infrastructure, ever.",
  },
];

const faqs = [
  {
    q: "How much does it cost?",
    a: "₹500 per month, recurring. You can cancel anytime — your membership stays active until the end of the current billing cycle.",
  },
  {
    q: "What if I miss a class?",
    a: "MVP does not include a recorded-video library. Each class is live on Google Meet. The WhatsApp reminder makes it easy to remember.",
  },
  {
    q: "Do I need to install anything?",
    a: "No app to install. You join via the Google Meet link sent to your WhatsApp.",
  },
  {
    q: "What happens on a holiday?",
    a: "The instructor can mark a no-class date. The platform skips Meet creation and suppresses the WhatsApp reminder for that date.",
  },
  {
    q: "Will my access be revoked if a payment is late?",
    a: "Membership state follows verified Razorpay events. If a renewal fails, your access is updated accordingly — never just because the browser said so.",
  },
  {
    q: "Is my WhatsApp number shared?",
    a: "We use it only for class reminders. Reminders are sent through the official Meta WhatsApp Business Cloud API.",
  },
];

export function Landing() {
  const { openAuth, setView } = useApp();

  return (
    <div className="hero-grad">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-16 md:py-24 grid gap-10 md:grid-cols-2 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live classes every morning · 7:00 AM IST
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Wake up to{" "}
              <span className="text-brand-gradient">live yoga</span>, every
              single day.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              A simple ₹500/month membership. A fresh Google Meet every
              morning. A gentle WhatsApp reminder 15 minutes before class.
              That&apos;s it — that&apos;s the whole platform.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-brand-gradient text-primary-foreground hover:opacity-90"
                onClick={() => openAuth("register")}
              >
                Start your membership
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setView("checkout")}
              >
                See how it works
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Cancel anytime
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> No app to install
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Secure recurring
                payments
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto max-w-sm">
              {/* Phone mockup with WhatsApp reminder */}
              <div className="rounded-[2.5rem] border-4 border-foreground/10 bg-card shadow-2xl overflow-hidden animate-floaty">
                <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-white/20 grid place-items-center">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Prana Yoga</p>
                      <p className="text-[10px] opacity-80">online</p>
                    </div>
                  </div>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="p-4 space-y-3 bg-secondary/30">
                  <div className="bg-white rounded-2xl rounded-tl-sm p-3 text-sm shadow-sm space-y-2">
                    <p className="font-medium">🧘 Yoga Class Reminder</p>
                    <p className="text-muted-foreground">
                      Hello Priya, today&apos;s yoga class starts at{" "}
                      <span className="font-semibold text-foreground">
                        7:00 AM
                      </span>
                      .
                    </p>
                    <p className="text-muted-foreground">
                      Join your live class:
                    </p>
                    <p className="text-emerald-700 font-medium text-[13px] break-all">
                      https://meet.google.com/yoga-7am
                    </p>
                    <p className="text-muted-foreground">See you soon! 🙏</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    6:45 AM · WhatsApp
                  </p>
                </div>
              </div>

              {/* Floating chips */}
              <div className="absolute -left-6 top-10 hidden md:flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-1.5 text-xs">
                <Video className="h-4 w-4 text-emerald-600" /> New Meet every day
              </div>
              <div className="absolute -right-4 bottom-24 hidden md:flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-1.5 text-xs">
                <Repeat className="h-4 w-4 text-emerald-600" /> ₹500/mo recurring
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="container mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Classes per week", value: "7" },
            { label: "Monthly fee", value: "₹500" },
            { label: "Reminder lead time", value: "15 min" },
            { label: "Time zone", value: "IST" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl md:text-3xl font-bold text-brand-gradient">
                {s.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="secondary" className="mb-3">
            Built for daily ritual
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything you need for a daily live yoga habit
          </h2>
          <p className="mt-3 text-muted-foreground">
            We strip away everything that isn&apos;t the practice. Just you, the
            teacher, and a fresh link to join — every single morning.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <Card
              key={f.title}
              className="border-border/60 hover:border-primary/40 transition shadow-sm"
            >
              <CardContent className="p-6">
                <div className="h-11 w-11 rounded-xl bg-brand-gradient/10 grid place-items-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-secondary/30 border-y border-border/60">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-3">
              How it works
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Four steps. Every morning.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="rounded-2xl bg-card border border-border/60 p-6 h-full">
                  <div className="h-9 w-9 rounded-full bg-brand-gradient text-primary-foreground grid place-items-center font-semibold mb-3">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="container mx-auto px-4 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="secondary" className="mb-3">
            Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            One plan. One price. No surprises.
          </h2>
          <p className="mt-3 text-muted-foreground">
            ₹500 per month, recurring. Cancel anytime and your access lasts
            till the end of the billing cycle.
          </p>
        </div>
        <div className="max-w-md mx-auto">
          <Card className="relative overflow-hidden border-primary/40 shadow-xl">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />
            <CardContent className="p-8 text-center space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Monthly Membership
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  <IndianRupee className="h-7 w-7 text-primary" />
                  <span className="text-5xl font-bold">500</span>
                  <span className="text-muted-foreground">/ month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Billed automatically via Razorpay Subscriptions
                </p>
              </div>
              <ul className="space-y-2.5 text-sm text-left max-w-xs mx-auto">
                {[
                  "Daily live classes on Google Meet",
                  "New Meet link every class day",
                  "WhatsApp reminder 15 min before class",
                  "Schedule with holiday / no-class exceptions",
                  "Cancel anytime",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full bg-brand-gradient text-primary-foreground"
                onClick={() => openAuth("register")}
              >
                Get started now
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-secondary/30 border-y border-border/60">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <Badge variant="secondary" className="mb-3">
              FAQ
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Good questions, gentle answers
            </h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible>
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="rounded-3xl bg-brand-gradient text-primary-foreground p-10 md:p-16 text-center relative overflow-hidden">
          <Heart className="absolute -top-6 -left-6 h-32 w-32 opacity-10" />
          <Heart className="absolute -bottom-8 -right-6 h-40 w-40 opacity-10" />
          <h2 className="text-3xl md:text-5xl font-bold mb-3">
            Your tomorrow starts on the mat.
          </h2>
          <p className="opacity-90 max-w-xl mx-auto mb-6">
            Register in 60 seconds. Subscribe for ₹500/month. Get your first
            WhatsApp reminder tonight.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => openAuth("register")}
          >
            Join Prana Live Yoga
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
