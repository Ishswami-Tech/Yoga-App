"use client";
import { usePlan } from "@/hooks/use-plan";
import { useEffect, useState } from "react";
import { useRazorpayCheckout } from "@/hooks/use-razorpay-checkout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check,
  AlertTriangle,
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
import { SunFan, Mandala } from "../art/sunrise";

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

const features = [
  "Daily live classes on Google Meet",
  "Fresh Meet link every class day",
  "WhatsApp reminder 15 min before",
  "Cancel anytime",
];

export function MembershipView() {
  const plan = usePlan();
  const { setView } = useApp();
  const qc = useQueryClient();
  // ?paymentStatus=SUCCESS|FAILED|CANCELLED is set when the student returns from the payment bridge.
  const [returnStatus] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("paymentStatus")
  );
  const meQ = useQuery<{ user: { name?: string; email?: string; phone?: string | null } | null }>({
    queryKey: ["me"],
    queryFn: () => apiGet("/api/auth/me"),
    retry: false,
  });
  const checkout = useRazorpayCheckout({
    user: meQ.data?.user,
    description: `Monthly membership, ${plan.display}/month`,
  });
  const { phase } = checkout;
  const busy = phase === "starting" || phase === "checkout";

  // Returning from the (legacy) payment bridge with SUCCESS: keep confirming until ACTIVE.
  useEffect(() => {
    if (returnStatus === "SUCCESS") void checkout.pollUntilActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subQ = useQuery<SubResp>({
    queryKey: ["subscription"],
    queryFn: () => apiGet<SubResp>("/api/subscription"),
    retry: false,
    refetchInterval: phase === "processing" ? 3000 : false,
  });

  const state = subQ.data?.state ?? "NONE";

  // The status is only a hint; membership turns ACTIVE once the server has verified the payment
  // (the processing step polls for that).
  useEffect(() => {
    if (!returnStatus) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    if (returnStatus === "SUCCESS") {
      toast.info("Confirming your payment…");
    } else if (returnStatus === "CANCELLED") {
      toast.info("Payment cancelled. You have not been charged.");
    } else {
      toast.error("We could not confirm your payment. If money was deducted it will reflect shortly.");
    }
  }, [returnStatus]);

  if (subQ.isLoading) return <MembershipSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[13px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Your membership
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight">Plan</h1>
          <p className="text-sm text-muted-foreground">
            {plan.display} / month · recurring · Razorpay
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
        <Card className="rounded-3xl bg-marigold/15 border-marigold/50 shadow-soft">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-marigold/40 grid place-items-center shrink-0">
              <Loader2 className="h-5 w-5 text-foreground animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg font-semibold">Verifying your payment…</p>
              <p className="text-sm text-muted-foreground">
                Your membership turns on as soon as Razorpay confirms the payment.
                This usually takes a few seconds.
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
        <Card className="rounded-3xl border-primary/40 bg-primary/5 shadow-soft">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 grid place-items-center shrink-0">
              <XCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg font-semibold">
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
          {(phase === "idle" || phase === "starting" || phase === "checkout" || phase === "cancelled") && (
            <div className="space-y-3">
              {phase === "cancelled" && (
                <p role="status" className="rounded-2xl bg-muted/60 p-3 text-sm font-bold">
                  Payment window closed. You have not been charged.
                </p>
              )}
              <PricingCard
                onSubscribe={() => void checkout.start()}
                loading={busy}
                ctaLabel={
                  state === "EXPIRED" || state === "HALTED"
                    ? `Renew ${plan.display}/month`
                    : state === "CANCELLED"
                    ? `Resubscribe ${plan.display}/month`
                    : `Subscribe ${plan.display}/month`
                }
              />
            </div>
          )}
          {phase === "processing" && (
            <ProcessingCard slow={checkout.slow} onRetry={() => void checkout.pollUntilActive()} />
          )}
          {phase === "success" && <SuccessCard onGo={() => setView("student-dashboard")} />}
          {phase === "failed" && (
            <Card className="rounded-3xl border-2 border-destructive shadow-soft">
              <CardContent className="p-6 text-center space-y-3">
                <h2 className="font-display text-2xl font-semibold">Payment not completed</h2>
                <p role="alert" className="text-sm text-muted-foreground">
                  {checkout.message ?? "Something went wrong with the payment."} You can try again.
                </p>
                <Button variant="outline" onClick={() => checkout.reset()}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          )}
          {phase === "unavailable" && (
            <Card className="rounded-3xl border-2 border-dashed shadow-soft">
              <CardContent className="p-6 text-center space-y-3">
                <AlertTriangle className="h-7 w-7 mx-auto text-primary" />
                <h2 className="font-display text-2xl font-semibold">Payments are temporarily unavailable</h2>
                <p role="alert" className="text-sm text-muted-foreground">
                  We cannot take payments right now. You have not been charged. Please try again later.
                </p>
                <Button variant="outline" onClick={() => checkout.reset()}>
                  Back
                </Button>
              </CardContent>
            </Card>
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
  const tile = "rounded-2xl bg-card px-3.5 py-2.5";
  const dt = "text-xs font-extrabold uppercase tracking-wider text-muted-foreground";
  const dd = "mt-0.5 text-[15px] font-extrabold";
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-sunrise-sky p-5 text-[#3B1F1A] shadow-lift">
        <SunFan
          size={240}
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20"
        />
        <div className="relative">
          <div className="text-[12.5px] font-extrabold uppercase tracking-wider">
            Monthly Membership
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[12.5px] font-extrabold uppercase tracking-wide">
              <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
              {sub.status}
            </span>
          </div>
          <div className="mt-2">
            <span className="font-display text-6xl font-bold leading-none tracking-tight">
              {formatINR(sub.amount)}
            </span>
            <span className="text-base font-extrabold"> / month</span>
          </div>
          <p className="mt-1 text-[11px] font-mono font-semibold break-all opacity-80">
            {sub.razorpaySubscriptionId}
          </p>
          <dl className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div className={tile}>
              <dt className={dt}>Next billing</dt>
              <dd className={`${dd} text-foreground`}>{prettyDate(sub.nextBillingDate)}</dd>
            </div>
            <div className={tile}>
              <dt className={dt}>Amount</dt>
              <dd className={`${dd} text-foreground`}>{formatINR(sub.amount)}</dd>
            </div>
            <div className={tile}>
              <dt className={dt}>Start date</dt>
              <dd className={`${dd} text-foreground`}>{prettyDate(sub.startDate)}</dd>
            </div>
            <div className={tile}>
              <dt className={dt}>End date</dt>
              <dd className={`${dd} text-foreground`}>{prettyDate(sub.endDate)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Pause membership self-service */}
      <PauseResumeCard />

      <CancelCard />
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
  const plan = usePlan();
  return (
    <Card className="relative overflow-hidden rounded-3xl border-0 shadow-soft">
      <div className="absolute inset-x-0 top-0 h-2 bg-sunrise-sky" />
      <Mandala size={150} className="pointer-events-none absolute -right-10 -top-10 opacity-60" />
      <CardContent className="relative p-6 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
              Monthly Membership
            </p>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold leading-none">₹{plan.rupees}</span>
              <span className="text-muted-foreground text-sm font-bold">/ month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Billed monthly via Razorpay autopay. Cancel anytime.
            </p>
          </div>
        </div>
        <ul className="space-y-2.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 font-semibold">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                <Check className="h-3 w-3" strokeWidth={3.4} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {!readonly && onSubscribe && (
          <Button
            size="lg"
            className="w-full min-h-14 text-base"
            disabled={loading}
            onClick={onSubscribe}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing checkout…
              </>
            ) : (
              ctaLabel ?? `Subscribe ${plan.display}/month`
            )}
          </Button>
        )}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" />
          Secure payment by Razorpay
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessingCard({ slow, onRetry }: { slow: boolean; onRetry: () => void }) {
  return (
    <Card className="rounded-3xl shadow-soft">
      <CardContent className="p-8 text-center space-y-4">
        <div role="status" aria-label="Confirming payment" className="relative mx-auto size-28">
          <SunFan size={112} className="absolute inset-0 opacity-80" />
          <Loader2 className="absolute inset-0 m-auto h-20 w-20 animate-spin text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="font-display text-2xl font-semibold">
          Confirming your <span className="text-primary">payment.</span>
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          We are confirming your payment with Razorpay and activating your membership.
          Please do not close this screen.
        </p>
        {slow && (
          <div className="max-w-sm mx-auto space-y-3">
            <p role="status" className="text-sm font-bold">
              This is taking longer than usual. If money was deducted your membership will
              activate shortly; you do not need to pay again.
            </p>
            <Button variant="outline" onClick={onRetry}>
              Check again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuccessCard({ onGo }: { onGo: () => void }) {
  return (
    <Card className="rounded-3xl shadow-soft">
      <CardContent className="p-8 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-[#8FAF8A] text-[#1F3A24] mx-auto grid place-items-center">
          <Check className="h-7 w-7" strokeWidth={3.4} />
        </div>
        <h2 className="font-display text-3xl font-semibold">
          You are in. <span className="text-primary">Welcome.</span>
        </h2>
        <p className="text-muted-foreground">
          You&apos;re all set. You&apos;ll receive a WhatsApp reminder 15
          minutes before each class.
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-4">
          <div className="rounded-2xl bg-muted/60 p-3">
            <Video className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xs font-bold text-muted-foreground">Daily Meet</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <MessageCircle className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xs font-bold text-muted-foreground">WhatsApp</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <ShieldCheck className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xs font-bold text-muted-foreground">Secured</p>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full min-h-14 text-base"
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
      <div className="h-48 w-full rounded-3xl bg-accent animate-pulse" />
    </div>
  );
}

// Pause/Resume membership self-service card.
// Calls the real Razorpay pause API through our server; billing stops until resumed.
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
    <Card className="rounded-3xl shadow-soft">
      <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-marigold/40 grid place-items-center shrink-0">
          <Pause className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-extrabold">Going on a break?</p>
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
              className="min-h-11"
              onClick={() => setConfirmPause(false)}
              disabled={pauseMut.isPending}
            >
              Keep active
            </Button>
            <Button
              className="min-h-11"
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
            size="lg"
            className="min-h-12"
            onClick={() => setConfirmPause(true)}
          >
            <Pause className="h-4 w-4" /> Pause membership
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CancelCard() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const cancelMut = useMutation({
    mutationFn: () => apiPost("/api/subscription/cancel", {}),
    onSuccess: () => {
      toast.success("Auto-renewal cancelled", {
        description: "You keep access until the end of the period you have already paid for.",
      });
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't cancel the membership"),
  });
  return (
    <Card className="rounded-3xl border-2 border-dashed shadow-none">
      <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-rose/50 grid place-items-center shrink-0">
          <CreditCard className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-extrabold">Need to cancel?</p>
          <p className="text-sm text-muted-foreground">
            Stop the monthly auto-debit any time. Your access continues until the end of the
            current billing cycle.
          </p>
        </div>
        {confirm ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="min-h-11" disabled={cancelMut.isPending} onClick={() => setConfirm(false)}>
              Keep membership
            </Button>
            <Button className="min-h-11" disabled={cancelMut.isPending} onClick={() => cancelMut.mutate()}>
              {cancelMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="border-primary text-primary min-h-12" onClick={() => setConfirm(true)}>
            Cancel auto-renewal
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
