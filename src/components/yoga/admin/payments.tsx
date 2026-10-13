"use client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { RefreshCw, Search, Inbox } from "lucide-react";
import { formatINR } from "@/components/yoga/student/format";
import {
  PageHeader,
  StatusBadge,
  ErrorCard,
  EmptyState,
  MonoText,
  KpiTile,
  FilterChip,
  TH_CLASS,
  istDate,
  istDateTime,
} from "./shared";
import { InitialsDot } from "@/components/yoga/art/admin-art";

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
  const [statusFilter, setStatusFilter] = useState("ALL");
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

  const shown = items.filter((p) => statusFilter === "ALL" || p.status === statusFilter);
  const STATUS_CHIPS = ["ALL", "CAPTURED", "PENDING", "FAILED", "REFUNDED"];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description="Every Razorpay payment captured by the verified webhook."
        actions={
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin", "payments"] })}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {/* Summary tiles */}
      <section aria-label="Revenue summary" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        <KpiTile tone="dark" label="Captured revenue" value={formatINR(summary.captured)} />
        <KpiTile label="Gateway fees" value={formatINR(summary.fees)} hint="fee + surcharge + GST" />
        <KpiTile tone="wait" label="Pending" value={formatINR(summary.pending)} />
        <KpiTile tone="bad" label="Failed" value={formatINR(summary.failed)} />
      </section>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 basis-72 max-w-md">
          <Label htmlFor="admin-payments-search" className="mb-1.5 block text-sm font-extrabold">
            Filter by user ID
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-payments-search"
              type="search"
              className="h-14 rounded-2xl border-2 bg-card pl-11 text-base font-bold"
              placeholder="e.g. usr_abc123"
              value={filterUser}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((st) => (
            <FilterChip key={st} active={statusFilter === st} onClick={() => setStatusFilter(st)}>
              {st === "ALL" ? "All" : st.charAt(0) + st.slice(1).toLowerCase()}
            </FilterChip>
          ))}
        </div>
        <span className="hidden sm:inline min-h-11 leading-[44px] text-sm font-semibold text-muted-foreground">
          {items.length} of 200 max
        </span>
      </div>

      {q.isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-full" />
            ))}
          </CardContent>
        </Card>
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load payments."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "payments", debouncedUser] })}
        />
      ) : shown.length === 0 ? (
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
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={TH_CLASS}>Student</TableHead>
                <TableHead className={TH_CLASS}>Payment ID</TableHead>
                <TableHead className={`text-right ${TH_CLASS}`}>Amount</TableHead>
                <TableHead className={TH_CLASS}>Status</TableHead>
                <TableHead className={`hidden md:table-cell text-right ${TH_CLASS}`}>Gateway fee</TableHead>
                <TableHead className={`hidden lg:table-cell ${TH_CLASS}`}>Paid at</TableHead>
                <TableHead className={`hidden lg:table-cell ${TH_CLASS}`}>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.id} className="border-t-2 border-dotted border-border border-b-0">
                  <TableCell className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <InitialsDot name={p.userName ?? "?"} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-extrabold">{p.userName ?? "—"}</span>
                        <span className="truncate text-sm font-semibold text-muted-foreground">
                          {p.userEmail ?? ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <MonoText>{p.razorpayPaymentId || "—"}</MonoText>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <span className="font-display text-lg font-bold">{formatINR(p.amount)}</span>
                  </TableCell>
                  <TableCell className="px-4">
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 text-right text-sm font-semibold text-muted-foreground">
                    {formatINR(
                      (p.gatewayFee ?? 0) +
                        (p.surcharge ?? 0) +
                        (p.surchargeGst ?? 0)
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 text-sm font-semibold text-muted-foreground">
                    {istDateTime(p.paidAt)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 text-sm font-semibold text-muted-foreground">
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
