"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  IndianRupee,
  Check,
  Sparkles,
  ShieldCheck,
  Loader2,
  Lock,
  Video,
  MessageCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import {
  MembershipStateBadge,
  KV,
  ErrorCard,
} from "./shared";
import { prettyDate, formatINR } from "./format";

type SubResp = {
  state: "NONE" | "PENDING" | "ACTIVE" | "EXPIRED" | "HALTED" | "CANCELLED";
  subscription: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    nextBillingDate: string | null;
    razorpaySubscriptionId: string;
  } | null;
};

type CreateResp = {
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  amount: number;
  currency: string;
  shortUrl?: string;
  status: string;
};

type SimulateResp = {
  ok: boolean;
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  webhookEventId: string;
};

type Step = "idle" | "checkout" | "processing" | "success";

const PRICE_PAISE = 50000; // ₹500
const features = [
  "Daily live classes on Google Meet",
  "Fresh Meet link every class day",
  "WhatsApp reminder 15 min before",
  "Cancel anytime",
];

export function MembershipView() {
  const { setView } = useApp();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [createData, setCreateData] = useState<CreateResp | null>(null);

  const subQ = useQuery<SubResp>({
    queryKey: ["subscription"],
    queryFn: () => apiGet<SubResp>("/api/subscription"),
    retry: false,
    refetchInterval: step === "processing" ? 800 : false,
  });

  const state = subQ.data?.state ?? "NONE";

  // Create subscription.
  const createMut = useMutation({
    mutationFn: () => apiPost<CreateResp>("/api/subscriptions/create", {}),
    onSuccess: (d) => {
      setCreateData(d);
      setStep("checkout");
    },
    onError: (e: ApiError | Error) => {
      toast.error((e as ApiError)?.message ?? "Failed to start checkout");
      setStep("idle");
    },
  });

  // Simulate customer completing Razorpay checkout; the server then fires
  // the verified webhook that activates the subscription.
  const payMut = useMutation({
    mutationFn: () =>
      apiPost<SimulateResp>("/api/subscriptions/simulate", {
        razorpaySubscriptionId: createData?.razorpaySubscriptionId,
      }),
    onSuccess: () => {
      setStep("processing");
      setProgress(0);
      toast.info("Waiting for the verified Razorpay webhook…");
    },
    onError: (e: ApiError | Error) => {
      toast.error((e as ApiError)?.message ?? "Payment failed");
      setStep("checkout");
    },
  });

  // While processing, poll /api/subscription; bail out when ACTIVE.
  useEffect(() => {
    if (step !== "processing") return;
    let done = false;
    const t = setInterval(async () => {
      setProgress((p) => Math.min(p + 8, 95));
      try {
        const m = await apiGet<SubResp>("/api/subscription");
        if (m.state === "ACTIVE" && !done) {
          done = true;
          clearInterval(t);
          setProgress(100);
          setTimeout(() => {
            setStep("success");
            toast.success("Membership active! Welcome to the mat 🧘");
            qc.invalidateQueries({ queryKey: ["subscription"] });
            qc.invalidateQueries({ queryKey: ["me"] });
            qc.invalidateQueries({ queryKey: ["classes", "today"] });
            qc.invalidateQueries({ queryKey: ["classes", "upcoming", 7] });
          }, 400);
        }
      } catch {
        // ignore transient errors
      }
    }, 600);
    return () => clearInterval(t);
  }, [step, qc]);

  if (subQ.isLoading) return <MembershipSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membership</h1>
          <p className="text-sm text-muted-foreground">
            ₹500 / month · recurring · Razorpay
          </p>
        </div>
        <MembershipStateBadge state={state} />
      </div>

      {/* ACTIVE */}
      {state === "ACTIVE" && subQ.data?.subscription && (
        <ActiveCard sub={subQ.data.subscription} />
      )}

      {/* PENDING */}
      {state === "PENDING" && (
        <Card className="border-amber-500/40">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-amber-500/15 grid place-items-center shrink-0">
              <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Verifying your payment…</p>
              <p className="text-sm text-muted-foreground">
                We never grant membership from the browser alone. We&apos;re
                waiting for the verified Razorpay webhook to land.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["subscription"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {/* EXPIRED / HALTED / CANCELLED — show prior status + renewal CTA */}
      {(state === "EXPIRED" ||
        state === "HALTED" ||
        state === "CANCELLED") && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-rose-500/15 grid place-items-center shrink-0">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {state === "EXPIRED"
                  ? "Your membership expired"
                  : state === "HALTED"
                  ? "Your membership is halted"
                  : "Your membership was cancelled"}
              </p>
              <p className="text-sm text-muted-foreground">
                Subscribe again to resume daily classes and WhatsApp reminders.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing / subscribe flow when no active membership */}
      {state !== "ACTIVE" && (
        <>
          {step === "idle" && (
            <PricingCard
              onSubscribe={() => createMut.mutate()}
              loading={createMut.isPending}
              ctaLabel={
                state === "PENDING"
                  ? "Subscribe ₹500/month"
                  : state === "EXPIRED" || state === "HALTED"
                  ? "Renew ₹500/month"
                  : state === "CANCELLED"
                  ? "Resubscribe ₹500/month"
                  : "Subscribe ₹500/month"
              }
            />
          )}
          {step === "checkout" && createData && (
            <CheckoutCard
              data={createData}
              onPay={() => payMut.mutate()}
              loading={payMut.isPending}
              onBack={() => setStep("idle")}
            />
          )}
          {step === "processing" && (
            <ProcessingCard progress={progress} />
          )}
          {step === "success" && (
            <SuccessCard onGo={() => setView("student-dashboard")} />
          )}
        </>
      )}

      {/* Pricing always visible below active as a reference */}
      {state === "ACTIVE" && <PricingCard readonly />}
    </div>
  );
}

function ActiveCard({
  sub,
}: {
  sub: NonNullable<SubResp["subscription"]>;
}) {
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden border-emerald-500/40">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-emerald-500" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Active subscription
              </p>
              <h2 className="text-xl font-bold">Monthly Membership</h2>
              <p className="text-sm text-muted-foreground">
                {formatINR(sub.amount)} / month · {sub.currency}
              </p>
            </div>
            <div className="text-right">
              <Badge
                variant="outline"
                className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              >
                {sub.status}
              </Badge>
              <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all max-w-[180px]">
                {sub.razorpaySubscriptionId}
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
            <KV label="Start date">{prettyDate(sub.startDate)}</KV>
            <KV label="Next billing">{prettyDate(sub.nextBillingDate)}</KV>
            <KV label="End date">{prettyDate(sub.endDate)}</KV>
            <KV label="Amount">{formatINR(sub.amount)}</KV>
          </div>
        </CardContent>
      </Card>

      {/* Pause membership self-service */}
      <PauseResumeCard />

      <Card className="border-dashed">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-muted grid place-items-center shrink-0">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Need to cancel?</p>
            <p className="text-sm text-muted-foreground">
              Subscriptions are managed by Razorpay. Cancel anytime from your
              Razorpay portal — access continues until the end of the current
              billing cycle.
            </p>
          </div>
          <Button variant="outline" disabled>
            Manage via Razorpay
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PricingCard({
  onSubscribe,
  loading,
  ctaLabel,
  readonly,
}: {
  onSubscribe?: () => void;
  loading?: boolean;
  ctaLabel?: string;
  readonly?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-primary/40 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />
      <CardContent className="p-6 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Monthly Membership
            </p>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="h-6 w-6 text-primary" />
              <span className="text-4xl font-bold">500</span>
              <span className="text-muted-foreground text-sm">/ month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Billed automatically via Razorpay Subscriptions
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-brand-gradient/10 grid place-items-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        </div>
        <ul className="space-y-2.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {!readonly && onSubscribe && (
          <Button
            size="lg"
            className="w-full bg-brand-gradient text-primary-foreground"
            disabled={loading}
            onClick={onSubscribe}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing checkout…
              </>
            ) : (
              ctaLabel ?? "Subscribe ₹500/month"
            )}
          </Button>
        )}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Server-side signature verification · idempotent webhooks
        </div>
      </CardContent>
    </Card>
  );
}

function CheckoutCard({
  data,
  onPay,
  loading,
  onBack,
}: {
  data: CreateResp;
  onPay: () => void;
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Razorpay Checkout</p>
              <p className="font-semibold">Pay {formatINR(PRICE_PAISE)}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="text-muted-foreground">Subscription ID</p>
            <p className="font-mono break-all max-w-[180px]">
              {data.razorpaySubscriptionId}
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
            <span>{formatINR(PRICE_PAISE)}</span>
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
              className={`rounded-lg border p-3 text-center text-sm transition ${
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
          disabled={loading}
          onClick={onPay}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Authorising…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Pay {formatINR(PRICE_PAISE)} &amp;
              subscribe
            </>
          )}
        </Button>
        <div className="flex items-center justify-between text-xs">
          <button
            className="text-muted-foreground underline underline-offset-4"
            onClick={onBack}
          >
            Cancel
          </button>
          <p className="text-muted-foreground">
            By paying you authorise Razorpay to charge ₹500 every 30 days until
            you cancel.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessingCard({ progress }: { progress: number }) {
  return (
    <Card>
      <CardContent className="p-8 text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        <h2 className="font-semibold text-lg">
          Waiting for verified webhook…
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Your checkout succeeded but we never grant membership from the
          browser. We&apos;re waiting for the verified Razorpay webhook to mark
          your subscription ACTIVE.
        </p>
        <Progress value={progress} className="max-w-sm mx-auto" />
        <p className="text-xs text-muted-foreground">
          {progress}% · signature verified ✓ · webhook received ✓
        </p>
      </CardContent>
    </Card>
  );
}

function SuccessCard({ onGo }: { onGo: () => void }) {
  return (
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
            <p className="text-[11px] text-muted-foreground">Daily Meet</p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3">
            <MessageCircle className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-[11px] text-muted-foreground">WhatsApp</p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3">
            <ShieldCheck className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-[11px] text-muted-foreground">Secured</p>
          </div>
        </div>
        <Button
          className="bg-brand-gradient text-primary-foreground"
          onClick={onGo}
        >
          Go to dashboard <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function MembershipSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-md bg-accent animate-pulse" />
          <div className="h-4 w-32 rounded-md bg-accent animate-pulse" />
        </div>
      </div>
      <div className="h-48 w-full rounded-xl bg-accent animate-pulse" />
    </div>
  );
}

// Pause/Resume membership self-service card.
// Uses the Razorpay adapter's halted/charged events through the verified-
// webhook path. The student can pause (halts the subscription — no future
// charges until resumed) and resume (re-activates via a charged event).
function PauseResumeCard() {
  const qc = useQueryClient();
  const [confirmPause, setConfirmPause] = useState(false);

  const pauseMut = useMutation({
    mutationFn: () => apiPost("/api/subscription/pause", {}),
    onSuccess: () => {
      toast.success("Membership paused", {
        description: "No future charges until you resume. Access continues until the end of the current cycle.",
      });
      setConfirmPause(false);
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't pause membership"),
  });

  const resumeMut = useMutation({
    mutationFn: () => apiPost("/api/subscription/resume", {}),
    onSuccess: () => {
      toast.success("Membership resumed!", {
        description: "Your subscription is active again. Welcome back! 🧘",
      });
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't resume membership"),
  });

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-amber-500/15 grid place-items-center shrink-0">
          <Pause className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Going on a break?</p>
          <p className="text-sm text-muted-foreground">
            Pause your membership — no charges while paused. Your access
            continues until the end of the current billing cycle, then resumes
            when you come back.
          </p>
        </div>
        {confirmPause ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmPause(false)}
              disabled={pauseMut.isPending}
            >
              Keep active
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 text-white hover:bg-amber-700"
              disabled={pauseMut.isPending}
              onClick={() => pauseMut.mutate()}
            >
              {pauseMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              Confirm pause
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-amber-700 border-amber-600/40 hover:bg-amber-500/10"
            onClick={() => setConfirmPause(true)}
          >
            <Pause className="h-4 w-4" /> Pause membership
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
