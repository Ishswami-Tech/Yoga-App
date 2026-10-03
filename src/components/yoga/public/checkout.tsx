"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiPost, apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  IndianRupee,
  Loader2,
  ShieldCheck,
  Check,
  Video,
  MessageCircle,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { PublicShell } from "./shell";

type Step = "review" | "checkout" | "processing" | "success" | "failed";

export function Checkout() {
  const { openAuth, setView } = useApp();
  const [step, setStep] = useState<Step>("review");
  const [progress, setProgress] = useState(0);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Bootstrap session to know if user is logged in.
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<{ user: any }>("/api/auth/me"),
  });

  // Create subscription (returns the data Razorpay Checkout needs).
  const createMut = useMutation({
    mutationFn: () => apiPost("/api/subscriptions/create", {}),
    onSuccess: (d: any) => {
      setPaymentData(d);
      setStep("checkout");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to start checkout"),
  });

  // Simulate the customer completing Razorpay Checkout. The server then
  // verifies the signature + Razorpay fires its webhook (which we simulate
  // via /api/subscriptions/simulate which calls applyRazorpayEvent).
  const payMut = useMutation({
    mutationFn: () =>
      apiPost("/api/subscriptions/simulate", {
        razorpaySubscriptionId: paymentData?.razorpaySubscriptionId,
      }),
    onSuccess: () => {
      setStep("processing");
      setProgress(0);
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Payment failed");
      setStep("failed");
    },
  });

  // Poll the membership state while "processing" to detect the webhook-driven
  // activation. The "payment succeeded on the browser" never grants
  // membership by itself.
  useEffect(() => {
    if (step !== "processing") return;
    let done = false;
    const t = setInterval(async () => {
      setProgress((p) => Math.min(p + 8, 95));
      try {
        const m = await apiGet<{ state: string }>("/api/subscription");
        if (m.state === "ACTIVE" && !done) {
          done = true;
          clearInterval(t);
          setProgress(100);
          setTimeout(() => setStep("success"), 400);
        }
      } catch {
        // ignore
      }
    }, 600);
    return () => clearInterval(t);
  }, [step]);

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
            <div className="h-14 w-14 rounded-full bg-brand-gradient mx-auto grid place-items-center mb-4">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Sign in to subscribe</h1>
            <p className="text-muted-foreground mb-6">
              You need an account before you can start the ₹500/month
              recurring membership.
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => setView("landing")}
              >
                Back to home
              </Button>
              <Button
                className="bg-brand-gradient text-primary-foreground"
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

  return (
    <PublicShell>
      <section className="container mx-auto px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <Badge variant="secondary" className="mb-2">
              ₹500 / month · recurring
            </Badge>
            <h1 className="text-3xl font-bold">
              Confirm your membership
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Hi {data.user.name.split(" ")[0]} — review and subscribe. We never
              activate membership from the browser alone; a verified Razorpay
              webhook is required.
            </p>
          </div>

          {/* STEPPER */}
          <div className="flex items-center justify-center gap-2 mb-6 text-xs">
            {[
              { k: "review", label: "Review" },
              { k: "checkout", label: "Checkout" },
              { k: "processing", label: "Webhook" },
              { k: "success", label: "Active" },
            ].map((s, i, arr) => {
              const order = ["review", "checkout", "processing", "success"];
              const cur = order.indexOf(step === "failed" ? "review" : step);
              const idx = order.indexOf(s.k);
              const active = idx <= cur;
              return (
                <div key={s.k} className="flex items-center gap-2">
                  <div
                    className={`h-7 w-7 rounded-full grid place-items-center border-2 ${
                      active
                        ? "bg-brand-gradient border-transparent text-primary-foreground"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {active && idx < cur ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={
                      active
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {s.label}
                  </span>
                  {i < arr.length - 1 && (
                    <div className="w-8 h-px bg-border" />
                  )}
                </div>
              );
            })}
          </div>

          {step === "review" && (
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-lg">Monthly Membership</h2>
                    <p className="text-sm text-muted-foreground">
                      Recurring · cancel anytime · Razorpay Subscriptions
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <IndianRupee className="h-5 w-5 text-primary" />
                      <span className="text-3xl font-bold">500</span>
                    </div>
                    <p className="text-xs text-muted-foreground">per month</p>
                  </div>
                </div>

                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">
                    Demo payment flow
                  </p>
                  Clicking <span className="font-semibold">Subscribe</span>{" "}
                  creates a real Razorpay-style subscription record. The mock
                  adapter then authorises the checkout and dispatches the
                  verified webhook that activates your membership.
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Server-side signature verification · idempotent webhooks
                </div>

                <Button
                  className="w-full bg-brand-gradient text-primary-foreground"
                  disabled={createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Preparing
                      checkout…
                    </>
                  ) : (
                    <>Subscribe ₹500/month</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "checkout" && paymentData && (
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Razorpay Checkout
                      </p>
                      <p className="font-semibold">Pay ₹500.00</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-muted-foreground">Subscription ID</p>
                    <p className="font-mono">
                      {paymentData.razorpaySubscriptionId}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <span>Monthly Membership</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Billing</span>
                    <span>Recurring · every 30 days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span>₹500.00</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-3">
                    <span>Total today</span>
                    <span className="flex items-center">
                      <IndianRupee className="h-4 w-4" /> 500.00
                    </span>
                  </div>
                </div>

                {/* Mock payment method selector */}
                <div className="grid grid-cols-3 gap-2">
                  {["UPI", "Cards", "Netbanking"].map((m, i) => (
                    <button
                      key={m}
                      className={`rounded-lg border p-3 text-center text-sm ${
                        i === 0
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-secondary/40"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <Button
                  className="w-full bg-brand-gradient text-primary-foreground"
                  disabled={payMut.isPending}
                  onClick={() => payMut.mutate()}
                >
                  {payMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Authorising…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Pay ₹500 &amp; subscribe
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  By paying you authorise Razorpay to charge ₹500 every 30 days
                  until you cancel.
                </p>
              </CardContent>
            </Card>
          )}

          {step === "processing" && (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <h2 className="font-semibold text-lg">
                  Waiting for verified webhook…
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Your checkout succeeded but we never grant membership from
                  the browser. We&apos;re waiting for the verified Razorpay
                  webhook to mark your subscription ACTIVE.
                </p>
                <Progress value={progress} className="max-w-sm mx-auto" />
                <p className="text-xs text-muted-foreground">
                  {progress}% · signature verified ✓ · webhook received ✓
                </p>
              </CardContent>
            </Card>
          )}

          {step === "success" && (
            <Card className="border-emerald-500/40">
              <CardContent className="p-8 text-center space-y-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500 mx-auto grid place-items-center">
                  <Check className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Membership active! 🧘</h2>
                <p className="text-muted-foreground">
                  You&apos;re all set. You&apos;ll receive a WhatsApp reminder 15
                  minutes before each class.
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-4">
                  <div className="rounded-lg bg-card border border-border p-3">
                    <Video className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-[11px] text-muted-foreground">
                      Daily Meet
                    </p>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3">
                    <MessageCircle className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-[11px] text-muted-foreground">
                      WhatsApp
                    </p>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3">
                    <ShieldCheck className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-[11px] text-muted-foreground">Secured</p>
                  </div>
                </div>
                <Button
                  className="bg-brand-gradient text-primary-foreground"
                  onClick={() => setView("student-dashboard")}
                >
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "failed" && (
            <Card className="border-destructive">
              <CardContent className="p-8 text-center space-y-4">
                <h2 className="text-xl font-bold">Payment failed</h2>
                <p className="text-muted-foreground">
                  No charge was made. You can try again.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setStep("review")}
                >
                  Try again
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
