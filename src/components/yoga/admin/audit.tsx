"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  ScrollText,
  RefreshCw,
  User as UserIcon,
  CalendarDays,
  CalendarOff,
  Video,
  RefreshCcw,
  Settings as SettingsIcon,
  Cog,
  Inbox,
} from "lucide-react";
import {
  PageHeader,
  ErrorCard,
  EmptyState,
  MonoText,
  istDateTime,
} from "./shared";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

type ListResp = { items: AuditEntry[] };

const ENTITY_FILTERS = [
  { value: "ALL", label: "All entities" },
  { value: "User", label: "User" },
  { value: "ClassSchedule", label: "Class schedule" },
  { value: "ClassException", label: "Class exception" },
  { value: "YogaClass", label: "Yoga class" },
  { value: "Subscription", label: "Subscription" },
  { value: "AppSettings", label: "App settings" },
  { value: "Worker", label: "Worker" },
];

const ENTITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  User: UserIcon,
  ClassSchedule: CalendarDays,
  ClassException: CalendarOff,
  YogaClass: Video,
  Subscription: RefreshCcw,
  AppSettings: SettingsIcon,
  Worker: Cog,
};

export function AuditView() {
  const [entityType, setEntityType] = useState("ALL");
  const qc = useQueryClient();
  const q = useQuery<ListResp>({
    queryKey: ["admin", "audit", entityType],
    queryFn: () =>
      apiGet<ListResp>(
        `/api/admin/audit${
          entityType !== "ALL" ? `?entityType=${entityType}` : ""
        }`
      ),
    refetchInterval: 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Every admin action recorded with actor, entity, and metadata."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "audit"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_FILTERS.map((f) => (
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
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load audit log."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "audit", entityType] })}
        />
      ) : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No audit entries"
          description="Admin actions (user edits, schedule changes, worker runs) will appear here."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="hidden md:table-cell">Actor</TableHead>
                <TableHead className="hidden lg:table-cell">Metadata</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data!.items.map((a) => {
                const Icon = ENTITY_ICON[a.entityType] ?? ScrollText;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="grid place-items-center h-7 w-7 rounded-md bg-brand-gradient/10 text-primary shrink-0">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm">{a.action}</span>
                          <MonoText className="lg:hidden">
                            {a.entityId.slice(0, 18)}
                            {a.entityId.length > 18 ? "…" : ""}
                          </MonoText>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className="border-border bg-muted text-muted-foreground w-fit"
                        >
                          {a.entityType}
                        </Badge>
                        <MonoText className="hidden lg:inline">
                          {a.entityId.slice(0, 24)}
                          {a.entityId.length > 24 ? "…" : ""}
                        </MonoText>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {a.actorName ?? "system"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {a.actorEmail ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <pre className="text-[10px] font-mono bg-muted/60 p-2 rounded-md max-w-[280px] overflow-x-auto scroll-soft">
                        {JSON.stringify(a.metadata ?? {}, null, 2)}
                      </pre>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {istDateTime(a.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
