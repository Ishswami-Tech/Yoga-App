"use client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, IndianRupee, Search, Receipt, Inbox } from "lucide-react";
import { formatINR } from "@/components/yoga/student/format";
import {
  PageHeader,
  StatusBadge,
  ErrorCard,
  EmptyState,
  MonoText,
  istDate,
  istDateTime,
} from "./shared";

type Payment = {
  id: string;
  razorpayPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  gatewayFee: number | null;
  surcharge: number | null;
  surchargeGst: number | null;
  paidAt: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
};

type ListResp = { items: Payment[] };

export function PaymentsView() {
  const [filterUser, setFilterUser] = useState("");
  const [debouncedUser, setDebouncedUser] = useState("");
  const qc = useQueryClient();

  // Debounce user filter.
  const onSearch = (val: string) => {
    setFilterUser(val);
    if (window) {
      window.clearTimeout((onSearch as any)._t);
      (onSearch as any)._t = window.setTimeout(
        () => setDebouncedUser(val.trim()),
        300
      );
    }
  };

  const q = useQuery<ListResp>({
    queryKey: ["admin", "payments", debouncedUser],
    queryFn: () =>
      apiGet<ListResp>(
        `/api/admin/payments${
          debouncedUser ? `?userId=${encodeURIComponent(debouncedUser)}` : ""
        }`
      ),
    refetchInterval: 60 * 1000,
  });

  const items = q.data?.items ?? [];

  const summary = useMemo(() => {
    let captured = 0;
    let fees = 0;
    let pending = 0;
    let failed = 0;
    for (const p of items) {
      if (p.status === "CAPTURED") captured += p.amount ?? 0;
      if (p.status === "PENDING") pending += p.amount ?? 0;
      if (p.status === "FAILED") failed += p.amount ?? 0;
      fees += (p.gatewayFee ?? 0) + (p.surcharge ?? 0) + (p.surchargeGst ?? 0);
    }
    return { captured, fees, pending, failed };
  }, [items]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Every Razorpay payment captured by the verified webhook."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin", "payments"] })}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Captured revenue"
          value={formatINR(summary.captured)}
          icon={<IndianRupee className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />}
          tone="emerald"
        />
        <SummaryCard
          label="Gateway fees"
          value={formatINR(summary.fees)}
          icon={<Receipt className="h-4 w-4 text-amber-700 dark:text-amber-300" />}
          tone="amber"
        />
        <SummaryCard
          label="Pending"
          value={formatINR(summary.pending)}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
          tone="muted"
        />
        <SummaryCard
          label="Failed"
          value={formatINR(summary.failed)}
          icon={<Receipt className="h-4 w-4 text-rose-700 dark:text-rose-300" />}
          tone="rose"
        />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Filter by user ID (e.g. usr_abc123)…"
                value={filterUser}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {items.length} of 200 max
            </span>
          </div>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load payments."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "payments", debouncedUser] })}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No payments yet"
          description={
            debouncedUser
              ? "No payments match that user ID."
              : "Payments appear here as the verified Razorpay webhook captures them."
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Gateway fee</TableHead>
                <TableHead className="hidden lg:table-cell">Paid at</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{p.userName ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.userEmail ?? ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MonoText>{p.razorpayPaymentId || "—"}</MonoText>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium">
                      <IndianRupee className="h-3 w-3 text-muted-foreground" />
                      {formatINR(p.amount).replace("₹", "")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {formatINR(
                      (p.gatewayFee ?? 0) +
                        (p.surcharge ?? 0) +
                        (p.surchargeGst ?? 0)
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {istDateTime(p.paidAt)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {istDate(p.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "muted" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : tone === "rose"
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
      : "bg-muted text-muted-foreground";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className={`grid place-items-center h-7 w-7 rounded-md ${toneClass}`}>
            {icon}
          </span>
        </div>
        <p className="text-xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
