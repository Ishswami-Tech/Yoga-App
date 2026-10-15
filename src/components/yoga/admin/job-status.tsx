"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "./shared";

type JobName = "generate" | "remind";
type JobState = "ok" | "failing" | "stale" | "never_run";

type JobItem = {
  job: JobName;
  state: JobState;
  lastRunAt: string | null;
  ageSeconds: number | null;
  lastOk: boolean | null;
  lastError: string | null;
  staleAfterSeconds: number;
};

type JobsResponse = { items: JobItem[]; now: string };

type RunResponse = {
  ok: boolean;
  job: JobName;
  skipped?: boolean;
  ms?: number;
  result?: unknown;
};

const QUERY_KEY = ["admin", "jobs"] as const;

const JOB_LABEL: Record<JobName, string> = {
  generate: "Class & Meet link creation",
  remind: "Class reminders",
};

const CHIP_STYLE: Record<JobState, { label: string; className: string }> = {
  ok: {
    label: "Running normally",
    className: "bg-[#DCEBD8] text-[#244B2B] border-transparent",
  },
  failing: {
    label: "Last run failed",
    className: "bg-[#F7C9B6] text-[#7A2A10] border-transparent",
  },
  stale: {
    label: "Not running",
    className: "bg-[#F7C9B6] text-[#7A2A10] border-transparent",
  },
  never_run: {
    label: "Waiting for first run",
    className: "bg-[#FBE3B0] text-[#5C3A00] border-transparent",
  },
};

function relative(seconds: number): string {
  if (seconds < 45) return "just now";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function detail(item: JobItem): string {
  if (item.ageSeconds === null) return "Has not run yet";
  const ago = relative(item.ageSeconds);
  if (item.state === "stale") {
    return `No run for ${ago.replace(" ago", "")}`;
  }
  return `Last run ${ago}`;
}

function JobRow({ item }: { item: JobItem }) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: () => apiPost<RunResponse>("/api/admin/jobs/run", { job: item.job }),
    onSuccess: (res) => {
      if (res.skipped) toast.info("Already running, skipped");
      else toast.success(`Job ran in ${res.ms ?? 0} ms`);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Job failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  const chip = CHIP_STYLE[item.state];

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-60 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-extrabold">{JOB_LABEL[item.job]}</span>
          <Badge className={chip.className}>{chip.label}</Badge>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{detail(item)}</p>
        {item.lastError && (
          <p
            className="truncate text-xs text-muted-foreground"
            title={item.lastError}
          >
            {item.lastError.length > 140 ? `${item.lastError.slice(0, 140)}…` : item.lastError}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => run.mutate()}
        disabled={run.isPending}
      >
        {run.isPending && <Spinner />} Run now
      </Button>
    </li>
  );
}

export function JobStatusCard() {
  const q = useQuery<JobsResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet<JobsResponse>("/api/admin/jobs"),
    refetchInterval: 30 * 1000,
    retry: false,
  });

  if (q.isLoading) return <Skeleton className="h-40 rounded-3xl" />;

  return (
    <Card className="gap-3 p-6">
      <CardContent className="space-y-2 p-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold leading-tight">Scheduled jobs</h2>
        </div>
        {q.isError || !q.data ? (
          <p className="text-sm font-semibold text-muted-foreground">
            Job status unavailable
          </p>
        ) : (
          <ul className="m-0 list-none divide-y-2 divide-dotted divide-border p-0">
            {q.data.items.map((item) => (
              <JobRow key={item.job} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
