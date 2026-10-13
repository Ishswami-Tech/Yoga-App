"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  RefreshCw,
  MoreHorizontal,
  Play,
  Inbox,
  Ban,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/components/yoga/student/format";
import {
  PageHeader,
  StatusBadge,
  ErrorCard,
  EmptyState,
  Spinner,
  MonoText,
  KpiTile,
  FilterChip,
  TH_CLASS,
  istDate,
} from "./shared";
import { InitialsDot } from "@/components/yoga/art/admin-art";

type Subscription = {
  id: string;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  status: string;
  amount: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
};

type ListResp = { items: Subscription[] };

const STATUS_FILTERS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "HALTED", label: "Halted" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

export function SubscriptionsView() {
  const [status, setStatus] = useState("ALL");
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const qc = useQueryClient();
  const q = useQuery<ListResp>({
    queryKey: ["admin", "subscriptions", status],
    queryFn: () =>
      apiGet<ListResp>(
        `/api/admin/subscriptions${status !== "ALL" ? `?status=${status}` : ""}`
      ),
    refetchInterval: 60 * 1000,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => apiPost(`/api/admin/subscriptions/${id}/cancel`),
    onSuccess: () => {
      toast.success("Subscription cancelled", {
        description:
          "Cancelled on Razorpay. Access continues until the paid period ends.",
      });
      setCancelTarget(null);
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't cancel subscription", { description: e.message }),
  });

  const items = q.data?.items ?? [];
  const activeItems = items.filter((s) => s.status === "ACTIVE");
  const mrr = activeItems.reduce((a, s) => a + s.amount, 0);
  const attention = items.filter(
    (s) => s.status === "HALTED" || s.status === "FAILED" || s.status === "PENDING"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Subscriptions"
        description="Recurring Razorpay memberships across all students."
        actions={
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] })}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {!q.isLoading && !q.isError && (
        <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <KpiTile label="Active subscriptions" value={activeItems.length} hint="paying on schedule" />
          <KpiTile tone="dark" label="Monthly recurring revenue" value={formatINR(mrr)} hint={`${activeItems.length} active in this view`} />
          <KpiTile tone="bad" label="Needs attention" value={attention} hint="pending, halted or failed" />
        </section>
      )}

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <FilterChip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
            {f.value === "ALL" ? "All" : f.label}
          </FilterChip>
        ))}
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
          message={(q.error as ApiError)?.message ?? "Couldn't load subscriptions."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "subscriptions", status] })}
        />
      ) : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No subscriptions found"
          description={`No subscriptions ${status === "ALL" ? "" : `with status ${status.toLowerCase()}`} yet.`}
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={TH_CLASS}>Student</TableHead>
                <TableHead className={TH_CLASS}>Subscription</TableHead>
                <TableHead className={TH_CLASS}>Status</TableHead>
                <TableHead className={TH_CLASS}>Amount</TableHead>
                <TableHead className={`hidden md:table-cell ${TH_CLASS}`}>Start</TableHead>
                <TableHead className={`hidden lg:table-cell ${TH_CLASS}`}>Next billing</TableHead>
                <TableHead className={`hidden lg:table-cell ${TH_CLASS}`}>End</TableHead>
                <TableHead className={`text-right ${TH_CLASS}`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data!.items.map((s) => (
                <TableRow key={s.id} className="border-t-2 border-dotted border-border border-b-0">
                  <TableCell className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <InitialsDot name={s.userName ?? "?"} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-extrabold">{s.userName ?? "Unknown"}</span>
                        <span className="truncate text-sm font-semibold text-muted-foreground">
                          {s.userEmail ?? "—"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <MonoText>{s.razorpaySubscriptionId}</MonoText>
                  </TableCell>
                  <TableCell className="px-4">
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="px-4">
                    <span className="font-display text-lg font-bold">{formatINR(s.amount)}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 text-sm font-semibold text-muted-foreground">
                    {istDate(s.startDate)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 text-sm font-semibold text-muted-foreground">
                    {istDate(s.nextBillingDate)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 text-sm font-semibold text-muted-foreground">
                    {istDate(s.endDate)}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label={`Actions for ${s.userName ?? "subscription"}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem asChild>
                          <a
                            href={`https://dashboard.razorpay.com/app/subscriptions/${encodeURIComponent(s.razorpaySubscriptionId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <RefreshCw className="h-4 w-4" /> View in Razorpay
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={
                            s.status === "CANCELLED" ||
                            s.status === "EXPIRED" ||
                            s.status === "FAILED"
                          }
                          onClick={() => setCancelTarget(s)}
                        >
                          <Ban className="h-4 w-4" /> Cancel subscription
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Cancel confirmation dialog */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => (o ? null : setCancelTarget(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  You&apos;re about to cancel{" "}
                  <span className="font-medium text-foreground">
                    {cancelTarget.userName}
                  </span>
                  &apos;s recurring ₹{formatINR(cancelTarget.amount).replace("₹", "")}/month
                  membership.
                  <br />
                  <br />
                  This dispatches the verified{" "}
                  <code className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                    subscription.cancelled
                  </code>{" "}
                  webhook. The student keeps access until the end of the current
                  billing cycle ({cancelTarget.endDate ? istDate(cancelTarget.endDate) : "—"}).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={cancelMut.isPending}
              onClick={() => cancelTarget && cancelMut.mutate(cancelTarget.id)}
            >
              {cancelMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Cancelling…
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" /> Cancel subscription
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
