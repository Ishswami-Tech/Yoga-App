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
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, prettyDate } from "@/components/yoga/student/format";
import { AdminRings, MembershipRings } from "@/components/yoga/art/admin-art";

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
        <SheetHeader className="sr-only">
          <SheetTitle>User details</SheetTitle>
          <SheetDescription>Profile, practice, membership and payments</SheetDescription>
        </SheetHeader>
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
          <div className="p-6 text-center text-[15px] font-semibold text-muted-foreground">
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

  const HEAD = "font-display text-xl font-semibold leading-tight";
  const LIST_ROW = "flex items-center justify-between gap-3 py-3 border-t-2 border-dotted border-border first:border-t-0";
  return (
    <div>
      {/* Header */}
      <div className="relative overflow-hidden bg-[#3B1F1A] p-6 text-[#FFF4E0]">
        <AdminRings size={260} className="pointer-events-none absolute -right-24 -top-24" />
        <div className="relative flex items-center gap-4">
          <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-[#F5A623] font-display text-3xl font-bold text-[#3B1F1A]">
            {initials}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-semibold leading-tight">{user.name}</h2>
            <p className="truncate text-sm font-semibold text-[#F7DCC8]">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="border-transparent bg-[#F3E3CF] text-[#5A372E] text-[13px] font-extrabold px-3">
                {user.role}
              </Badge>
              <Badge
                className={`border-transparent text-[13px] font-extrabold px-3 ${
                  user.status === "ACTIVE"
                    ? "bg-[#DCEBD8] text-[#244B2B]"
                    : "bg-[#F7C9B6] text-[#7A2A10]"
                }`}
              >
                {user.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-7">
        {/* Contact */}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </dl>

        {/* Attendance stats */}
        {user.role === "STUDENT" && (
          <section aria-label="Attendance">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
              Attendance streak
            </p>
            <p className="font-display text-5xl font-bold leading-[1.05] mt-1">
              {attendance.currentStreak} {attendance.currentStreak === 1 ? "day" : "days"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox icon={Flame} value={attendance.currentStreak} label="Streak" tone="amber" />
              <StatBox icon={Trophy} value={attendance.longestStreak} label="Best" tone="rose" />
              <StatBox icon={Check} value={attendance.totalAttended} label="Total" tone="emerald" />
              <StatBox icon={TrendingUp} value={attendance.last30Days} label="30 days" tone="primary" />
            </div>
            {attendance.attendedToday && (
              <Badge className="mt-3 border-transparent bg-[#DCEBD8] text-[#244B2B] text-[13px] font-extrabold px-3">
                <Check className="h-3 w-3" /> Attended today
              </Badge>
            )}
          </section>
        )}

        {/* Today's class + Meet link */}
        {todaysClasses.length > 0 && (
          <section aria-label="Today's class">
            <h3 className={`${HEAD} mb-3 flex items-center gap-2`}>
              <Video className="h-5 w-5 text-primary" /> Today&apos;s class
            </h3>
            <div className="space-y-3">
              {todaysClasses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-3xl bg-secondary p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold truncate">{c.scheduleName}</p>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {c.startTime} – {c.endTime}
                    </p>
                  </div>
                  {c.meetUrl ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Copy Meet link"
                        onClick={() => copyMeet(c.meetUrl!)}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <a
                        href={c.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open Meet link"
                        className="inline-flex items-center justify-center size-11 rounded-full border-2 border-foreground/80 hover:bg-accent"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ) : (
                    <Badge className="border-transparent bg-[#FBE3B0] text-[#5C3A00] text-[13px] font-extrabold px-3">
                      No link
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active membership */}
        {activeMembership ? (
          <section
            aria-label="Subscription"
            className="relative overflow-hidden rounded-3xl bg-[#FFF0DA] p-6 text-[#3B1F1A] shadow-soft"
          >
            <MembershipRings className="pointer-events-none absolute -bottom-12 -right-12" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <h3 className={HEAD}>Active membership</h3>
                <Badge className="border-transparent bg-[#DCEBD8] text-[#244B2B] text-[13px] font-extrabold px-3">
                  Active
                </Badge>
              </div>
              <p className="mt-2 font-display text-5xl font-bold leading-[1.1]">
                {formatINR(activeMembership.amount)}
                <span className="font-sans text-[15px] font-bold text-[#5A372E]"> / month</span>
              </p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[15px] font-bold">
                <dt className="text-[#5A372E]">Next billing</dt>
                <dd className="text-right">
                  {activeMembership.nextBillingDate
                    ? prettyDate(activeMembership.nextBillingDate.slice(0, 10))
                    : "—"}
                </dd>
                <dt className="text-[#5A372E]">Expires</dt>
                <dd className="text-right">
                  {activeMembership.endDate
                    ? prettyDate(activeMembership.endDate.slice(0, 10))
                    : "—"}
                </dd>
              </dl>
            </div>
          </section>
        ) : (
          <div className="flex items-center gap-2 rounded-3xl bg-[#FBE3B0] p-4 font-extrabold text-[#5C3A00]">
            <CreditCard className="h-5 w-5" /> No active membership
          </div>
        )}

        {/* Subscriptions */}
        {subscriptions.length > 0 && (
          <section aria-label="Subscriptions">
            <h3 className={`${HEAD} mb-1`}>Subscriptions ({subscriptions.length})</h3>
            <ul className="max-h-56 overflow-y-auto scroll-soft">
              {subscriptions.map((s) => (
                <li key={s.id} className={LIST_ROW}>
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] font-semibold truncate text-muted-foreground">
                      {s.razorpaySubscriptionId}
                    </p>
                    <p className="text-[15px] font-extrabold">{prettyDate(s.createdAt.slice(0, 10))}</p>
                  </div>
                  <Badge
                    className={`border-transparent text-[13px] font-extrabold px-3 ${
                      s.status === "ACTIVE"
                        ? "bg-[#DCEBD8] text-[#244B2B]"
                        : s.status === "CANCELLED"
                        ? "bg-[#F7C9B6] text-[#7A2A10]"
                        : "bg-[#F3E3CF] text-[#5A372E]"
                    }`}
                  >
                    {s.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Payments */}
        {payments.length > 0 && (
          <section aria-label="Payments">
            <h3 className={`${HEAD} mb-1`}>Payments ({payments.length})</h3>
            <ul className="max-h-64 overflow-y-auto scroll-soft">
              {payments.map((p) => (
                <li key={p.id} className={LIST_ROW}>
                  <div className="min-w-0">
                    <p className="text-[15px] font-extrabold">
                      {p.paidAt ? prettyDate(p.paidAt.slice(0, 10)) : "—"}
                    </p>
                    <p className="font-mono text-[13px] font-semibold truncate text-muted-foreground">
                      {p.razorpayPaymentId}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-display text-[22px] font-bold">{formatINR(p.amount)}</span>
                    <Badge
                      className={`border-transparent text-[13px] font-extrabold px-3 ${
                        p.status === "CAPTURED"
                          ? "bg-[#DCEBD8] text-[#244B2B]"
                          : "bg-[#FBE3B0] text-[#5C3A00]"
                      }`}
                    >
                      {p.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </section>
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
      className={`rounded-2xl p-3 ${
        warning ? "bg-[#FBE3B0] text-[#5C3A00]" : "bg-secondary text-secondary-foreground"
      }`}
    >
      <dt
        className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.08em] ${
          warning ? "" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[15px] font-bold" title={value}>
        {value}
      </dd>
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
      ? "bg-[#FBE3B0] text-[#5C3A00]"
      : tone === "rose"
      ? "bg-[#F7C9B6] text-[#7A2A10]"
      : tone === "emerald"
      ? "bg-[#DCEBD8] text-[#244B2B]"
      : "bg-[#3B1F1A] text-[#FFF4E0]";
  return (
    <div className={`rounded-3xl p-3 text-center ${toneClass}`}>
      <Icon className="h-4 w-4 mx-auto mb-1" />
      <p className="font-display text-3xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.06em]">{label}</p>
    </div>
  );
}
