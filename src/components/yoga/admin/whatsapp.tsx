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
  MessageCircle,
  RotateCcw,
  RefreshCw,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { prettyTime, prettyDate } from "@/components/yoga/student/format";
import {
  PageHeader,
  StatusBadge,
  ErrorCard,
  EmptyState,
  Spinner,
  MonoText,
  istDateTime,
} from "./shared";

type WhatsAppMessage = {
  id: string;
  userId: string;
  classId: string;
  templateName: string;
  providerMessageId: string | null;
  status: string;
  sentAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  studentName: string | null;
  studentEmail: string | null;
  whatsapp: string | null;
  classDate: string | null;
  classTime: string | null;
  scheduleName: string | null;
};

type ListResp = { items: WhatsAppMessage[] };

const STATUS_FILTERS = [
  { value: "ALL", label: "All statuses" },
  { value: "SENT", label: "Sent" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "IGNORED", label: "Ignored" },
];

export function WhatsAppView() {
  const [status, setStatus] = useState("ALL");
  const qc = useQueryClient();
  const q = useQuery<ListResp>({
    queryKey: ["admin", "whatsapp", status],
    queryFn: () =>
      apiGet<ListResp>(
        `/api/admin/whatsapp${status !== "ALL" ? `?status=${status}` : ""}`
      ),
    refetchInterval: 60 * 1000,
  });

  const retryMut = useMutation({
    mutationFn: () => apiPost(`/api/admin/classes/generate?job=retry`, {}),
    onSuccess: (data) => {
      toast.success("Retry job complete", {
        description: `Result: ${JSON.stringify(data.result).slice(0, 120)}`,
      });
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Retry job failed", { description: e.message }),
  });

  const failedCount = q.data?.items.filter((m) => m.status === "FAILED").length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp logs"
        description="15-minute class reminders dispatched to each student's WhatsApp number."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "whatsapp"] })}
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => retryMut.mutate()}
              disabled={retryMut.isPending}
            >
              {retryMut.isPending ? (
                <Spinner />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}{" "}
              Retry failed
            </Button>
          </>
        }
      />

      {failedCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            <span className="font-medium">{failedCount}</span> message
            {failedCount === 1 ? "" : "s"} failed delivery. Click{" "}
            <span className="font-medium">Retry failed</span> to re-queue them
            through the worker.
          </p>
        </div>
      )}

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
          message={(q.error as ApiError)?.message ?? "Couldn't load WhatsApp logs."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "whatsapp", status] })}
        />
      ) : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No WhatsApp messages"
          description={
            status === "FAILED"
              ? "No failed messages — reminders are flowing smoothly."
              : "Reminders will show up here once the worker dispatches them."
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">WhatsApp</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Provider ID</TableHead>
                <TableHead className="hidden lg:table-cell">Sent at</TableHead>
                <TableHead className="hidden xl:table-cell">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data!.items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid place-items-center h-7 w-7 rounded-md bg-brand-gradient/10 text-primary shrink-0">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-sm truncate">
                          {m.studentName ?? "Unknown"}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {m.studentEmail ?? ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {m.whatsapp ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {m.scheduleName ?? "—"}
                      </span>
                      {m.classDate && (
                        <span className="text-[11px] text-muted-foreground">
                          {prettyDate(m.classDate)} · {prettyTime(m.classTime)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {m.providerMessageId ? (
                      <MonoText>{m.providerMessageId.slice(0, 20)}{m.providerMessageId.length > 20 ? "…" : ""}</MonoText>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {istDateTime(m.sentAt)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs text-rose-700 dark:text-rose-300">
                    {m.errorCode || m.errorMessage ? (
                      <div className="flex flex-col">
                        {m.errorCode && <span className="font-mono">{m.errorCode}</span>}
                        {m.errorMessage && (
                          <span className="truncate max-w-[200px]">
                            {m.errorMessage}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
