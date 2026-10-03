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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  IndianRupee,
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
  istDate,
} from "./shared";

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

  const simulateMut = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/api/subscriptions/simulate`, {
        razorpaySubscriptionId: id,
      }),
    onSuccess: () => {
      toast.success("Subscription charged via webhook", {
        description: "Verified webhook activation path executed.",
      });
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't simulate charge", { description: e.message }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => apiPost(`/api/admin/subscriptions/${id}/cancel`),
    onSuccess: () => {
      toast.success("Subscription cancelled", {
        description:
          "The verified subscription.cancelled webhook has been applied.",
      });
      setCancelTarget(null);
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't cancel subscription", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscriptions"
        description="Recurring Razorpay memberships across all students."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Start</TableHead>
                <TableHead className="hidden lg:table-cell">Next billing</TableHead>
                <TableHead className="hidden lg:table-cell">End</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data!.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {s.userName ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.userEmail ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MonoText>{s.razorpaySubscriptionId}</MonoText>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium">
                      <IndianRupee className="h-3 w-3 text-muted-foreground" />
                      {formatINR(s.amount).replace("₹", "")}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {istDate(s.startDate)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {istDate(s.nextBillingDate)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {istDate(s.endDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Subscription actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={() => simulateMut.mutate(s.razorpaySubscriptionId)}
                          disabled={
                            (simulateMut.isPending &&
                            simulateMut.variables === s.razorpaySubscriptionId) ||
                            s.status === "CANCELLED" ||
                            s.status === "EXPIRED"
                          }
                        >
                          {simulateMut.isPending &&
                          simulateMut.variables === s.razorpaySubscriptionId ? (
                            <Spinner />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          Simulate recurring charge
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
                        <DropdownMenuItem disabled>
                          <RefreshCw className="h-4 w-4" /> Manage via Razorpay
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
                  <code className="rounded bg-muted px-1 text-xs">
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
