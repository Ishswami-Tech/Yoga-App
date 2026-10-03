"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  Phone,
  MessageCircle,
  CalendarDays,
  CreditCard,
  Flame,
  Trophy,
  TrendingUp,
  Video,
  Copy,
  Check,
  ExternalLink,
  IndianRupee,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, prettyDate } from "@/components/yoga/student/format";

type UserDetail = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    phone: string | null;
    whatsappNumber: string | null;
    createdAt: string;
  };
  subscriptions: {
    id: string;
    razorpaySubscriptionId: string;
    status: string;
    amount: number;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    nextBillingDate: string | null;
    createdAt: string;
  }[];
  payments: {
    id: string;
    razorpayPaymentId: string;
    amount: number;
    currency: string;
    status: string;
    gatewayFee: number;
    paidAt: string | null;
    createdAt: string;
  }[];
  attendance: {
    currentStreak: number;
    longestStreak: number;
    totalAttended: number;
    last30Days: number;
    attendedToday: boolean;
  };
  activeMembership: {
    endDate: string | null;
    nextBillingDate: string | null;
    amount: number;
  } | null;
  todaysClasses: {
    id: string;
    scheduleName: string;
    startTime: string;
    endTime: string;
    status: string;
    meetUrl: string | null;
  }[];
};

export function UserDetailDrawer({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const q = useQuery<UserDetail>({
    queryKey: ["admin", "user-detail", userId],
    queryFn: () => apiGet<UserDetail>(`/api/admin/users/${userId}/detail`),
    enabled: !!userId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto scroll-soft p-0">
        {q.isLoading || !q.data ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : q.isError ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load user details. {(q.error as ApiError)?.message}
          </div>
        ) : (
          <UserDetailContent data={q.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function UserDetailContent({ data }: { data: UserDetail }) {
  const { user, subscriptions, payments, attendance, activeMembership, todaysClasses } = data;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const [copied, setCopiedState] = useState(false);

  const copyMeet = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 1500);
      toast.success("Meet link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div>
      {/* Header with gradient */}
      <div className="relative bg-brand-gradient p-6 text-primary-foreground">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/30">
            <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{user.name}</h2>
            <p className="text-sm text-primary-foreground/80 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className="border-transparent bg-white/20 text-white text-[10px]">
                {user.role}
              </Badge>
              <Badge
                className={`border-transparent text-[10px] ${
                  user.status === "ACTIVE"
                    ? "bg-emerald-400/30 text-white"
                    : "bg-rose-400/30 text-white"
                }`}
              >
                {user.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Contact */}
        <div className="grid grid-cols-2 gap-3">
          <ContactRow icon={Mail} label="Email" value={user.email} />
          <ContactRow icon={Phone} label="Phone" value={user.phone || "—"} />
          <ContactRow
            icon={MessageCircle}
            label="WhatsApp"
            value={user.whatsappNumber || "—"}
            warning={!user.whatsappNumber}
          />
          <ContactRow
            icon={CalendarDays}
            label="Joined"
            value={prettyDate(user.createdAt.slice(0, 10))}
          />
        </div>

        {/* Attendance stats */}
        {user.role === "STUDENT" && (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-600" /> Practice stats
            </h3>
            <div className="grid grid-cols-4 gap-2">
              <StatBox icon={Flame} value={attendance.currentStreak} label="Streak" tone="amber" />
              <StatBox icon={Trophy} value={attendance.longestStreak} label="Best" tone="rose" />
              <StatBox icon={Check} value={attendance.totalAttended} label="Total" tone="emerald" />
              <StatBox icon={TrendingUp} value={attendance.last30Days} label="30d" tone="primary" />
            </div>
            {attendance.attendedToday && (
              <Badge className="mt-2 border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">
                <Check className="h-3 w-3" /> Attended today
              </Badge>
            )}
          </div>
        )}

        {/* Today's class + Meet link */}
        {todaysClasses.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Video className="h-4 w-4 text-primary" /> Today&apos;s class
            </h3>
            <div className="space-y-2">
              {todaysClasses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.scheduleName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.startTime} – {c.endTime}
                    </p>
                  </div>
                  {c.meetUrl ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyMeet(c.meetUrl!)}
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <a
                        href={c.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-accent/40"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      No link
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active membership */}
        {activeMembership ? (
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm font-medium">Active membership</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatINR(activeMembership.amount)}/mo</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Next billing</span>
              <span className="font-medium">
                {activeMembership.nextBillingDate
                  ? prettyDate(activeMembership.nextBillingDate.slice(0, 10))
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium">
                {activeMembership.endDate
                  ? prettyDate(activeMembership.endDate.slice(0, 10))
                  : "—"}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-sm text-amber-700 dark:text-amber-400">
            No active membership
          </div>
        )}

        {/* Subscriptions */}
        {subscriptions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Subscriptions ({subscriptions.length})
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto scroll-soft">
              {subscriptions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/60 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-mono truncate">{s.razorpaySubscriptionId}</p>
                    <p className="text-muted-foreground">{prettyDate(s.createdAt.slice(0, 10))}</p>
                  </div>
                  <Badge
                    className={`text-[10px] border-transparent ${
                      s.status === "ACTIVE"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : s.status === "CANCELLED"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments */}
        {payments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Payments ({payments.length})
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto scroll-soft">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/60 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{formatINR(p.amount)}</p>
                    <p className="text-muted-foreground font-mono truncate">
                      {p.razorpayPaymentId}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      className={`text-[10px] border-transparent ${
                        p.status === "CAPTURED"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {p.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {p.paidAt ? prettyDate(p.paidAt.slice(0, 10)) : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        warning
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border/60 bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p
        className={`text-sm font-medium mt-0.5 truncate ${
          warning ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tone: "amber" | "rose" | "emerald" | "primary";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : tone === "rose"
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
      : tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "bg-primary/10 text-primary";
  return (
    <div className={`rounded-lg p-2.5 text-center ${toneClass}`}>
      <Icon className="h-3.5 w-3.5 mx-auto mb-0.5" />
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[9px] uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

// useState import at top of file
