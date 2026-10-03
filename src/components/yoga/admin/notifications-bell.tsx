"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

type Notification = {
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  link: string;
  count: number;
};

type NotificationsResp = {
  items: Notification[];
  summary: { total: number; critical: number; warning: number; info: number };
};

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  info: {
    icon: Info,
    color: "text-muted-foreground",
    bg: "bg-secondary",
    border: "border-border",
  },
};

export function NotificationsBell() {
  const { setView } = useApp();
  const q = useQuery<NotificationsResp>({
    queryKey: ["admin", "notifications"],
    queryFn: () => apiGet<NotificationsResp>("/api/admin/notifications"),
    refetchInterval: 60 * 1000,
  });

  const items = q.data?.items ?? [];
  const summary = q.data?.summary ?? { total: 0, critical: 0, warning: 0, info: 0 };
  const hasItems = items.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 rounded-lg hover:bg-accent/40 grid place-items-center transition"
          aria-label={`Notifications — ${summary.total} items`}
        >
          <Bell className="h-5 w-5" />
          {summary.total > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold grid place-items-center ${
                summary.critical > 0
                  ? "bg-rose-500 text-white"
                  : summary.warning > 0
                  ? "bg-amber-500 text-white"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {summary.total > 9 ? "9+" : summary.total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Notifications</p>
            {hasItems ? (
              <div className="flex items-center gap-1.5">
                {summary.critical > 0 && (
                  <Badge variant="outline" className="border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px]">
                    {summary.critical} critical
                  </Badge>
                )}
                {summary.warning > 0 && (
                  <Badge variant="outline" className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
                    {summary.warning} warning
                  </Badge>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto scroll-soft">
          {q.isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : !hasItems ? (
            <div className="p-8 flex flex-col items-center gap-2 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 grid place-items-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted-foreground">
                No items need your attention right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((item) => {
                const cfg = SEVERITY_CONFIG[item.severity];
                const Icon = cfg.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => setView(item.link as any)}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-accent/40 transition group"
                  >
                    <div className={`h-8 w-8 rounded-lg ${cfg.bg} grid place-items-center shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-primary transition" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
  </Popover>
  );
}
