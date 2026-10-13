"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, RefreshCw, History, Info } from "lucide-react";
import { api, apiGet, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, ErrorCard } from "./shared";
import { MembershipRings, CornerSun } from "@/components/yoga/art/admin-art";

type Pricing = {
  amountPaise: number;
  currency: string;
  isSuperAdmin: boolean;
  minPaise: number;
  maxPaise: number;
  existingMembers: string;
  razorpay: { configured: boolean };
  history: {
    amountPaise: number;
    at: string;
    byUserId: string | null;
    byName: string | null;
  }[];
};

const inr = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function PricingView() {
  const qc = useQueryClient();
  const q = useQuery<Pricing>({
    queryKey: ["admin", "pricing"],
    queryFn: () => apiGet<Pricing>("/api/admin/pricing"),
    staleTime: 30 * 1000,
  });

  const saveMut = useMutation({
    mutationFn: (amountPaise: number) =>
      api<unknown>("/api/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({ amountPaise }),
      }),
    onSuccess: (_d, amountPaise) => {
      toast.success(`Membership price updated to ${inr(amountPaise)}/month`);
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["admin", "pricing"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't update the price", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Plan and pricing"
        description="The monthly membership price students pay."
        actions={
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin", "pricing"] })}
          >
            <RefreshCw className="h-4 w-4" /> Reload
          </Button>
        }
      />
      {q.isLoading ? (
        <Skeleton className="h-72 rounded-3xl" />
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load pricing."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "pricing"] })}
        />
      ) : !q.data ? null : (
        <PricingBody
          key={q.data.amountPaise}
          data={q.data}
          saving={saveMut.isPending}
          onSave={(p) => saveMut.mutate(p)}
        />
      )}
    </div>
  );
}

function PricingBody({
  data,
  saving,
  onSave,
}: {
  data: Pricing;
  saving: boolean;
  onSave: (paise: number) => void;
}) {
  const initialRupees = String(data.amountPaise / 100);
  const [value, setValue] = useState(initialRupees);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const minR = Math.ceil(data.minPaise / 100);
  const maxR = Math.floor(data.maxPaise / 100);
  const rupees = /^\d+$/.test(value) ? parseInt(value, 10) : NaN;
  const inRange = Number.isFinite(rupees) && rupees >= minR && rupees <= maxR;
  const changed = Number.isFinite(rupees) && rupees * 100 !== data.amountPaise;
  const error =
    value !== "" && !inRange
      ? `Enter a whole number of rupees between ${inr(minR * 100)} and ${inr(maxR * 100)}.`
      : null;
  const canEdit = data.isSuperAdmin;

  const previewR = Number.isFinite(rupees) ? rupees * 100 : data.amountPaise;

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden gap-0 p-0">
        <MembershipRings className="pointer-events-none absolute -right-12 -top-12" />
        <CardContent className="relative space-y-7 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
                Membership price
              </p>
              <p className="mt-1 font-display text-5xl font-bold leading-[1.1] md:text-[56px]">
                {inr(data.amountPaise)}
                <span className="font-sans text-base font-bold text-muted-foreground"> / month</span>
              </p>
            </div>
            <Badge
              variant="outline"
              className={`min-h-7 px-3 text-[13px] font-extrabold border-transparent ${
                !data.razorpay.configured
                  ? "bg-[#FBE3B0] text-[#5C3A00] dark:bg-[#F5A623]/25 dark:text-[#FBE3B0]"
                  : "bg-[#DCEBD8] text-[#244B2B] dark:bg-[#2F5A36]/60 dark:text-[#DCEBD8]"
              }`}
            >
              {data.razorpay.configured
                ? "Razorpay: Live"
                : "Razorpay: Not configured"}
            </Badge>
          </div>

          <div className="max-w-sm">
            <Label htmlFor="plan-price" className="mb-1.5 block text-sm font-extrabold">
              Price per month (whole rupees)
            </Label>
            <div className="flex h-[60px] items-stretch overflow-hidden rounded-2xl border-2 border-input bg-card focus-within:ring-[3px] focus-within:ring-foreground/80">
              <span
                aria-hidden="true"
                className="flex items-center border-r-2 border-input bg-secondary px-[18px] font-display text-2xl font-bold"
              >
                ₹
              </span>
              <Input
                id="plan-price"
                type="number"
                inputMode="numeric"
                className="h-full flex-1 rounded-none border-0 bg-transparent px-[18px] text-2xl font-bold shadow-none focus-visible:ring-0"
                min={minR}
                max={maxR}
                step={1}
                value={value}
                disabled={!canEdit || saving}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={!!error}
              />
            </div>
            {error ? (
              <p className="mt-2 text-sm font-bold text-destructive">{error}</p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Allowed range: {inr(minR * 100)} to {inr(maxR * 100)}.
              </p>
            )}
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-foreground/80">
              <Lock className="h-4 w-4 text-primary" /> Only super admins can change this price.
            </p>
          </div>

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-3 p-0 font-display text-[22px] font-semibold">
              What happens to current members?
            </legend>
            <RadioGroup value="KEEP_CURRENT_PRICE" className="flex flex-wrap gap-4">
              <label className="flex min-w-0 flex-[1_1_300px] items-start gap-3 rounded-3xl border-2 border-[#5E8A5A] bg-[#EEF4EC] p-4 text-[#19301d] dark:bg-[#2F5A36]/30 dark:text-foreground">
                <RadioGroupItem value="KEEP_CURRENT_PRICE" id="opt-keep" className="mt-1 size-5" />
                <span>
                  <span className="block text-[17px] font-extrabold">Keep their current price until they cancel</span>
                  <span className="mt-0.5 block text-sm font-semibold leading-snug">
                    Only new subscriptions use the new price.
                  </span>
                </span>
              </label>
              <label className="flex min-w-0 flex-[1_1_300px] items-start gap-3 rounded-3xl border-2 border-border bg-secondary/60 p-4">
                <RadioGroupItem value="MOVE_AT_RENEWAL" id="opt-move" disabled className="mt-1 size-5" />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold">
                    Move them to the new price at their next renewal
                    <Badge className="border-transparent bg-[#FBE3B0] px-3 text-[13px] font-extrabold text-[#5C3A00]">
                      Coming soon
                    </Badge>
                  </span>
                </span>
              </label>
            </RadioGroup>
          </fieldset>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                disabled={!inRange || !changed || saving}
                onClick={() => setConfirmOpen(true)}
              >
                Save price
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={!changed || saving}
                onClick={() => setValue(initialRupees)}
              >
                Discard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live preview */}
      <section aria-labelledby="pricing-preview" className="space-y-3">
        <div>
          <h2 id="pricing-preview" className="font-display text-[22px] font-semibold leading-tight">
            Live preview
          </h2>
          <p className="text-[15px] font-semibold text-muted-foreground">
            How the price appears to students once saved.
          </p>
        </div>
        <div className="flex flex-wrap gap-5">
          <div className="min-w-0 flex-[1_1_300px] rounded-3xl bg-[#3B1F1A] p-[18px]">
            <p className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[#F7DCC8]">
              Landing page, plan card
            </p>
            <div className="relative overflow-hidden rounded-[22px] bg-[#FFF4E0] px-5 py-[18px] text-[#3B1F1A]">
              <CornerSun className="pointer-events-none absolute -right-4 -top-4 scale-75" />
              <p className="relative text-xs font-extrabold uppercase tracking-[0.06em] text-[#6B4338]">
                Yoga Membership, monthly
              </p>
              <p className="relative my-1.5 flex items-baseline gap-2">
                <span className="font-display text-[42px] font-bold leading-none">{inr(previewR)}</span>
                <span className="font-bold text-[#6B4338]">/ month</span>
              </p>
              <span className="relative mt-2 flex min-h-11 items-center justify-center rounded-full bg-[#B8461F] text-[15px] font-extrabold text-white">
                Get started
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-[1_1_300px] rounded-3xl bg-[#3B1F1A] p-[18px]">
            <p className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[#F7DCC8]">
              Checkout screen
            </p>
            <div className="relative overflow-hidden rounded-[22px] bg-[#B8461F] px-5 py-[18px] text-white">
              <svg aria-hidden="true" width="120" height="120" viewBox="0 0 120 120" className="pointer-events-none absolute -bottom-12 -right-8">
                <circle cx="60" cy="60" r="34" fill="#F5A623" />
                <circle cx="60" cy="60" r="46" fill="none" stroke="#F5A623" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
              </svg>
              <div className="relative">
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#FFE9CC]">Your plan</p>
                <p className="my-1 font-display text-[19px] font-semibold">Yoga Membership, monthly</p>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-display text-[38px] font-bold leading-none">{inr(previewR)}</span>
                  <span className="text-sm font-bold">/ month</span>
                </p>
                <span className="mt-3 inline-block rounded-full bg-[#3B1F1A] px-4 py-2.5 text-sm font-extrabold">
                  Pay {inr(previewR)} securely
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-history" className="space-y-3">
        <h2 id="pricing-history" className="flex items-center gap-2 font-display text-[22px] font-semibold leading-tight">
          <History className="h-5 w-5" /> Price history
        </h2>
        {data.history.length === 0 ? (
          <p className="text-[15px] font-semibold text-muted-foreground">No price changes recorded yet.</p>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="h-12 bg-secondary px-5 text-[13px] font-extrabold uppercase tracking-[0.06em] text-foreground">Price</TableHead>
                  <TableHead className="h-12 bg-secondary px-5 text-[13px] font-extrabold uppercase tracking-[0.06em] text-foreground">Date</TableHead>
                  <TableHead className="h-12 bg-secondary px-5 text-[13px] font-extrabold uppercase tracking-[0.06em] text-foreground">Changed by</TableHead>
                  <TableHead className="h-12 bg-secondary px-5 text-[13px] font-extrabold uppercase tracking-[0.06em] text-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.history.map((h, i) => (
                  <TableRow key={`${h.at}-${i}`} className="border-t-2 border-dotted border-border border-b-0">
                    <TableCell className="px-5 py-4 font-display text-xl font-bold">{inr(h.amountPaise)}/month</TableCell>
                    <TableCell className="px-5 font-semibold text-muted-foreground">{fmtWhen(h.at)}</TableCell>
                    <TableCell className="px-5 font-semibold">{h.byName ?? "System"}</TableCell>
                    <TableCell className="px-5">
                      <Badge
                        className={`min-h-7 border-transparent px-3 text-[13px] font-extrabold ${
                          h.amountPaise === data.amountPaise && i === 0
                            ? "bg-[#DCEBD8] text-[#244B2B]"
                            : "bg-[#F3E3CF] text-[#5A372E]"
                        }`}
                      >
                        {h.amountPaise === data.amountPaise && i === 0 ? "Current" : "Replaced"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        <p className="flex items-center gap-2.5 px-1 text-sm font-semibold text-muted-foreground">
          <Info className="h-5 w-5 shrink-0 text-primary" />
          Every price change is recorded in the audit log with who made it and when.
        </p>
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the membership price?</AlertDialogTitle>
            <AlertDialogDescription>
              New members will pay {Number.isFinite(rupees) ? inr(rupees * 100) : ""} per month.
              Existing members keep their current price until they cancel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                if (inRange) onSave(rupees * 100);
              }}
            >
              Confirm new price
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
