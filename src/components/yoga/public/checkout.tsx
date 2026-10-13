"use client";
import { usePlan } from "@/hooks/use-plan";
import { useQuery } from "@tanstack/react-query";
import { useRazorpayCheckout } from "@/hooks/use-razorpay-checkout";
import { useApp } from "@/lib/store";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Check,
  Video,
  MessageCircle,
  Lock,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  Clock,
} from "lucide-react";
import { PublicShell } from "./shell";
import { LotusMark, Mandala, SunFan } from "../art/sunrise";

export function Checkout() {
  const plan = usePlan();
  const { openAuth, setView } = useApp();

  // Bootstrap session to know if user is logged in.
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<{ user: any }>("/api/auth/me"),
  });

  const checkout = useRazorpayCheckout({
    user: data?.user,
    description: `Monthly membership, ${plan.display}/month`,
  });
  const { phase } = checkout;
  const step: "review" | "processing" | "success" | "failed" | "unavailable" =
    phase === "processing"
      ? "processing"
      : phase === "success"
        ? "success"
        : phase === "failed"
          ? "failed"
          : phase === "unavailable"
            ? "unavailable"
            : "review";
  const busy = phase === "starting" || phase === "checkout";

  const features = [
    "Daily live yoga classes",
    "Fresh Google Meet every day",
    "WhatsApp reminder 15 min before class",
    "Cancel anytime",
  ];

  // If not logged in, show a "register first" panel.
  if (!data?.user) {
    return (
      <PublicShell>
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="mx-auto mb-5 w-fit">
              <LotusMark size={64} />
            </div>
            <h1 className="font-display text-3xl font-semibold mb-2">Sign in to subscribe</h1>
            <p className="text-muted-foreground mb-6">
              You need an account before you can start the {plan.display}/month
              recurring membership.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setView("landing")}
              >
                Back to home
              </Button>
              <Button
                onClick={() => openAuth("register")}
              >
                Create account
              </Button>
            </div>
          </div>
        </section>
      </PublicShell>
    );
  }

  const stepOrder = ["review", "processing", "success"];
  const stepCur = stepOrder.indexOf(step === "failed" || step === "unavailable" ? "review" : step);
  const heading =
    step === "processing"
      ? "Confirming your payment"
      : step === "success"
        ? "You are in. Welcome."
        : "Confirm your membership";

  return (
    <PublicShell>
      <section className="container mx-auto px-4 py-8 sm:py-10">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-5">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight">
              {heading}
            </h1>
            {step !== "success" && (
              <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                Hi {data.user.name.split(" ")[0]}, review your plan and subscribe
                securely with Razorpay.
              </p>
            )}
          </div>

          {/* STEPPER */}
          <ol
            aria-label="Progress"
            className="flex items-start mb-6 text-xs list-none p-0"
          >
            {[
              { k: "review", label: "Review" },
              { k: "processing", label: "Confirm" },
              { k: "success", label: "Active" },
            ].map((s, i, arr) => {
              const idx = stepOrder.indexOf(s.k);
              const done = idx < stepCur;
              const current = idx === stepCur;
              return (
                <li
                  key={s.k}
                  aria-current={current ? "step" : undefined}
                  className="relative flex-1 flex flex-col items-center gap-1.5"
                >
                  {i < arr.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-1/2 top-[15px] w-full border-t-[3px] border-dotted ${
                        done ? "border-[#8FAF8A]" : "border-border"
                      }`}
                    />
                  )}
                  <span
                    className={`relative size-8 rounded-full grid place-items-center box-border ${
                      done
                        ? "bg-[#8FAF8A] text-[#1F3A24]"
                        : current
                          ? "bg-marigold border-[3px] border-foreground"
                          : "bg-card border-[3px] border-dashed border-input"
                    }`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" strokeWidth={3.4} />
                    ) : current ? (
                      <span className="size-2.5 rounded-full bg-foreground" />
                    ) : null}
                  </span>
                  <span
                    className={`text-[13px] ${
                      done || current
                        ? "font-extrabold text-foreground"
                        : "font-bold text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {step === "review" && (
            <div className="space-y-4">
              <section
                aria-label="Your plan"
                className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-6 shadow-lift"
              >
                <Mandala
                  size={210}
                  rays
                  ring="#FFE9CC"
                  className="absolute -right-14 -bottom-20 opacity-60"
                />
                <div className="relative">
                  <div className="text-[13px] font-extrabold uppercase tracking-[0.08em] opacity-90">
                    Your plan
                  </div>
                  <h2 className="font-display text-2xl font-semibold mt-1 mb-1.5 leading-tight">
                    Monthly Membership
                  </h2>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-5xl font-bold leading-none">
                      ₹{plan.rupees}
                    </span>
                    <span className="text-[17px] font-bold">/ month</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[13.5px] font-extrabold">
                    <RefreshCw className="h-4 w-4" />
                    Renews monthly
                  </div>
                </div>
              </section>

              <Card className="rounded-3xl shadow-soft">
                <CardContent className="px-5 py-2">
                  <ul className="divide-y-2 divide-dotted divide-border">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-3 py-3 text-[15px] font-bold">
                        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" />
                Secure payment by Razorpay · UPI autopay, cards and netbanking
              </div>

              <Button
                size="lg"
                className="w-full min-h-14 text-lg bg-foreground text-background hover:bg-foreground/90"
                disabled={busy}
                onClick={() => checkout.start()}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing
                    checkout…
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    Subscribe {plan.display}/month
                  </>
                )}
              </Button>
              {phase === "cancelled" && (
                <p role="status" className="text-center text-sm font-bold text-foreground">
                  Payment window closed. You have not been charged.
                </p>
              )}
              <p className="text-center text-sm font-bold text-muted-foreground">
                By subscribing you authorise Razorpay to charge {plan.display} every month
                until you cancel. Membership starts once payment is confirmed.
              </p>
            </div>
          )}

          {step === "processing" && (
            <div className="space-y-4">
              <Card className="relative overflow-hidden rounded-3xl shadow-soft">
                <CardContent className="p-8 text-center space-y-4">
                  <div role="status" aria-label="Confirming payment" className="relative mx-auto size-36">
                    <SunFan size={144} className="absolute inset-0 opacity-80" />
                    <Loader2 className="absolute inset-0 m-auto h-24 w-24 animate-spin text-primary" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-display text-3xl font-semibold leading-tight">
                    Confirming your <span className="text-primary">payment.</span>
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    We are confirming your payment with Razorpay and activating
                    your membership.
                  </p>
                  {checkout.slow && (
                    <div className="max-w-sm mx-auto space-y-3">
                      <p role="status" className="text-sm font-bold">
                        This is taking longer than usual. If money was deducted your
                        membership will activate shortly; you do not need to pay again.
                      </p>
                      <Button variant="outline" onClick={() => void checkout.pollUntilActive()}>
                        Check again
                      </Button>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 min-h-11 rounded-full bg-background px-5 text-sm font-extrabold shadow-soft">
                    <Clock className="h-5 w-5 text-primary" />
                    This usually takes a few seconds.
                  </div>
                </CardContent>
              </Card>
              <p className="rounded-3xl bg-card shadow-soft p-4 text-sm font-semibold">
                Please do not close this screen or press back while we confirm.
              </p>
            </div>
          )}

          {step === "success" && (
            <Card className="relative overflow-hidden rounded-3xl shadow-soft">
              <div aria-hidden="true" className="h-28 bg-sunrise-sky" />
              <CardContent className="p-8 pt-0 text-center space-y-4 -mt-8">
                <div className="size-16 rounded-full bg-[#8FAF8A] text-[#1F3A24] mx-auto grid place-items-center border-4 border-card">
                  <Check className="h-8 w-8" strokeWidth={3.4} />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8FAF8A] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#1F3A24]">
                  Membership active
                </span>
                <h2 className="font-display text-3xl font-semibold">
                  You are in. <span className="text-primary">Welcome.</span>
                </h2>
                <p className="text-muted-foreground">
                  You&apos;re all set. You&apos;ll receive a WhatsApp reminder 15
                  minutes before each class.
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
                  <div className="rounded-2xl bg-muted/60 p-3">
                    <Video className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Daily Meet
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-3">
                    <MessageCircle className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs font-bold text-muted-foreground">
                      WhatsApp
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-3">
                    <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs font-bold text-muted-foreground">Secured</p>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full min-h-14 text-lg"
                  onClick={() => setView("student-dashboard")}
                >
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "failed" && (
            <Card className="rounded-3xl border-2 border-destructive shadow-soft">
              <CardContent className="p-8 text-center space-y-4">
                <h2 className="font-display text-2xl font-semibold">Payment not completed</h2>
                <p role="alert" className="text-muted-foreground">
                  {checkout.message ?? "Something went wrong with the payment."} You can try again.
                </p>
                <Button variant="outline" onClick={() => checkout.reset()}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "unavailable" && (
            <Card className="rounded-3xl border-2 border-dashed shadow-soft">
              <CardContent className="p-8 text-center space-y-4">
                <AlertTriangle className="h-8 w-8 mx-auto text-primary" />
                <h2 className="font-display text-2xl font-semibold">Payments are temporarily unavailable</h2>
                <p role="alert" className="text-muted-foreground">
                  We cannot take payments right now. You have not been charged. Please try again a little later.
                </p>
                <Button variant="outline" onClick={() => checkout.reset()}>
                  Back
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
