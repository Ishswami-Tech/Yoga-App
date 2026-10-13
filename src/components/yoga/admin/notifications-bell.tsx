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
    color: "text-[#7A2A10] dark:text-[#F7C9B6]",
    bg: "bg-[#F7C9B6] dark:bg-[#E8792B]/25",
    border: "border-[#7A2A10]/30",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-[#5C3A00] dark:text-[#FBE3B0]",
    bg: "bg-[#FBE3B0] dark:bg-[#F5A623]/25",
    border: "border-[#5C3A00]/30",
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
          className="relative size-11 rounded-full hover:bg-accent grid place-items-center transition outline-none focus-visible:ring-[3px] focus-visible:ring-foreground/80"
          aria-label={`Notifications — ${summary.total} items`}
        >
          <Bell className="h-5 w-5" />
          {summary.total > 0 && (
            <span
              className={`absolute top-0.5 right-0.5 h-5 min-w-5 px-1 rounded-full text-xs font-extrabold grid place-items-center ${
                summary.critical > 0
                  ? "bg-[#7A2A10] text-white"
                  : summary.warning > 0
                  ? "bg-[#F5A623] text-[#3B1F1A]"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {summary.total > 9 ? "9+" : summary.total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden rounded-3xl p-0">
        <div className="px-5 py-4 border-b-2 border-dotted border-border">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Notifications</p>
            {hasItems ? (
              <div className="flex items-center gap-1.5">
                {summary.critical > 0 && (
                  <Badge variant="outline" className="border-transparent bg-[#F7C9B6] text-[#7A2A10] text-xs font-extrabold">
                    {summary.critical} critical
                  </Badge>
                )}
                {summary.warning > 0 && (
                  <Badge variant="outline" className="border-transparent bg-[#FBE3B0] text-[#5C3A00] text-xs font-extrabold">
                    {summary.warning} warning
                  </Badge>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto scroll-soft">
          {q.isLoading ? (
            <div className="p-6 text-center text-[15px] font-semibold text-muted-foreground">
              Loading…
            </div>
          ) : !hasItems ? (
            <div className="p-8 flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-[#DCEBD8] grid place-items-center">
                <CheckCircle2 className="h-6 w-6 text-[#244B2B]" />
              </div>
              <p className="font-display text-lg font-semibold">All clear</p>
              <p className="text-sm font-semibold text-muted-foreground">
                No items need your attention right now.
              </p>
            </div>
          ) : (
            <div className="divide-y-2 divide-dotted divide-border">
              {items.map((item) => {
                const cfg = SEVERITY_CONFIG[item.severity];
                const Icon = cfg.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => setView(item.link as any)}
                    className="w-full min-h-14 flex items-start gap-3 p-4 text-left hover:bg-accent/50 transition group outline-none focus-visible:bg-accent/50"
                  >
                    <div className={`h-8 w-8 rounded-full ${cfg.bg} grid place-items-center shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-extrabold truncate">{item.title}</p>
                      <p className="text-sm font-semibold text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition" />
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
