"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Receipt, Inbox, IndianRupee, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { ErrorCard, EmptyState } from "./shared";
import { formatINR, prettyDate } from "./format";

function openReceipt(id: string) {
  const url = `/api/payments/${id}/receipt`;
  const w = window.open(url, "_blank", "noopener,noreferrer,width=820,height=900");
  if (!w) {
    toast.error("Pop-up blocked", {
      description: "Allow pop-ups to open the receipt, or click again.",
    });
  } else {
    toast.success("Opening receipt", {
      description: "Use Print / Save as PDF from the receipt page.",
    });
  }
}

type Payment = {
  id: string;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  gatewayFee: number | null;
  surcharge: number | null;
  surchargeGst: number | null;
  paidAt: string | null;
  createdAt: string;
  subscriptionStatus: string | null;
};

type Resp = { items: Payment[] };

export function PaymentsView() {
  const qc = useQueryClient();
  const q = useQuery<Resp>({
    queryKey: ["payments"],
    queryFn: () => apiGet<Resp>("/api/payments"),
    retry: false,
  });

  if (q.isLoading) return <PaymentsSkeleton />;
  if (q.isError)
    return (
      <ErrorCard
        message={(q.error as any)?.message ?? "Couldn't load your payments."}
        onRetry={() => qc.invalidateQueries({ queryKey: ["payments"] })}
      />
    );
  if (!q.data || q.data.items.length === 0)
    return (
      <EmptyState
        icon={Inbox}
        title="No payments yet"
        description="Once your first Razorpay payment is captured, it will appear here with full breakdown."
      />
    );

  const total = q.data.items
    .filter((p) => p.status === "captured")
    .reduce((acc, p) => acc + (p.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Razorpay billing history · all amounts in INR
          </p>
        </div>
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/15 grid place-items-center">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total paid</p>
              <p className="text-lg font-bold">{formatINR(total)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment ID</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {p.paidAt
                        ? prettyDate(p.paidAt.slice(0, 10))
                        : prettyDate(p.createdAt.slice(0, 10))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Sub: {p.subscriptionStatus ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatINR(p.amount)}
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={p.status} />
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground break-all">
                    {p.razorpayPaymentId ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {p.gatewayFee != null ? formatINR(p.gatewayFee) : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReceipt(p.id)}
                    disabled={p.status !== "CAPTURED" && p.status !== "captured"}
                    title={
                      p.status === "CAPTURED" || p.status === "captured"
                        ? "Download / print receipt"
                        : "Receipt available after payment is captured"
                    }
                  >
                    <Download className="h-4 w-4" />
                    Receipt
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {q.data.items.map((p) => (
          <Card key={p.id} className="border-border/60">
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {formatINR(p.amount)}
                  </span>
                  <PaymentStatusBadge status={p.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {p.paidAt
                    ? prettyDate(p.paidAt.slice(0, 10))
                    : prettyDate(p.createdAt.slice(0, 10))}
                </p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {p.razorpayPaymentId ?? "—"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-right text-xs text-muted-foreground">
                  <p>Fee</p>
                  <p className="text-foreground font-medium">
                    {p.gatewayFee != null ? formatINR(p.gatewayFee) : "—"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReceipt(p.id)}
                  disabled={p.status !== "CAPTURED" && p.status !== "captured"}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Showing {q.data.items.length} payment
        {q.data.items.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls =
    "border-border bg-muted text-muted-foreground";
  if (s === "captured")
    cls =
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  else if (s === "pending")
    cls =
      "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
  else if (s === "failed" || s === "refunded")
    cls =
      "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300";
  return (
    <Badge variant="outline" className={cls}>
      {status}
    </Badge>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-md bg-accent animate-pulse" />
          <div className="h-4 w-40 rounded-md bg-accent animate-pulse" />
        </div>
      </div>
      <Card>
        <div className="p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full rounded-md bg-accent animate-pulse"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
