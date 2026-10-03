"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, apiGet, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings as SettingsIcon,
  Save,
  IndianRupee,
  MessageCircle,
  CalendarClock,
  Bell,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/components/yoga/student/format";
import { PageHeader, ErrorCard, Spinner } from "./shared";

type Settings = {
  razorpayPlanId: string;
  razorpayPlanAmount: number;
  razorpayPlanCurrency: string;
  whatsappTemplate: string;
  lookAheadDays: number;
  reminderMinutesBefore: number;
};

export function SettingsView() {
  const qc = useQueryClient();
  const q = useQuery<Settings>({
    queryKey: ["admin", "settings"],
    queryFn: () => apiGet<Settings>("/api/admin/settings"),
    staleTime: 60 * 1000,
  });

  const saveMut = useMutation({
    mutationFn: (body: Partial<Settings>) =>
      api<{ ok: boolean }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't save settings", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Global app configuration — Razorpay plan, reminder timing, WhatsApp template."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin", "settings"] })}
          >
            <RefreshCw className="h-4 w-4" /> Reload
          </Button>
        }
      />

      {q.isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
            <Skeleton className="h-9 w-32" />
          </CardContent>
        </Card>
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load settings."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "settings"] })}
        />
      ) : !q.data ? null : (
        <SettingsForm
          key="settings"
          initial={q.data}
          isPending={saveMut.isPending}
          onSave={(body) => saveMut.mutate(body)}
        />
      )}
    </div>
  );
}

function SettingsForm({
  initial,
  isPending,
  onSave,
}: {
  initial: Settings;
  isPending: boolean;
  onSave: (body: Partial<Settings>) => void;
}) {
  const [razorpayPlanId, setRazorpayPlanId] = useState(initial.razorpayPlanId);
  const [razorpayPlanAmount, setRazorpayPlanAmount] = useState(
    String(initial.razorpayPlanAmount)
  );
  const [razorpayPlanCurrency, setRazorpayPlanCurrency] = useState(
    initial.razorpayPlanCurrency
  );
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    initial.whatsappTemplate
  );
  const [lookAheadDays, setLookAheadDays] = useState(
    String(initial.lookAheadDays)
  );
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(
    String(initial.reminderMinutesBefore)
  );

  const dirty =
    razorpayPlanId !== initial.razorpayPlanId ||
    parseInt(razorpayPlanAmount, 10) !== initial.razorpayPlanAmount ||
    razorpayPlanCurrency !== initial.razorpayPlanCurrency ||
    whatsappTemplate !== initial.whatsappTemplate ||
    parseInt(lookAheadDays, 10) !== initial.lookAheadDays ||
    parseInt(reminderMinutesBefore, 10) !== initial.reminderMinutesBefore;

  const lookAheadValid =
    /^\d+$/.test(lookAheadDays) &&
    parseInt(lookAheadDays, 10) >= 1 &&
    parseInt(lookAheadDays, 10) <= 30;
  const reminderValid =
    /^\d+$/.test(reminderMinutesBefore) &&
    parseInt(reminderMinutesBefore, 10) >= 1 &&
    parseInt(reminderMinutesBefore, 10) <= 180;
  const amountValid =
    /^\d+$/.test(razorpayPlanAmount) &&
    parseInt(razorpayPlanAmount, 10) >= 0;
  const valid =
    dirty &&
    lookAheadValid &&
    reminderValid &&
    amountValid &&
    razorpayPlanId.trim().length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Form */}
      <Card className="lg:col-span-2 border-border/60">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" />
            <p className="font-medium">Platform configuration</p>
          </div>

          {/* Razorpay section */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5" />
              Razorpay subscription plan
            </div>
            <Field label="Plan ID">
              <Input
                value={razorpayPlanId}
                onChange={(e) => setRazorpayPlanId(e.target.value)}
                placeholder="plan_yoga_monthly_500"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Plan amount"
                hint={`= ${formatINR(parseInt(razorpayPlanAmount, 10) || 0)}`}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  value={razorpayPlanAmount}
                  onChange={(e) => setRazorpayPlanAmount(e.target.value)}
                  min={0}
                  step={100}
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={razorpayPlanCurrency}
                  onValueChange={setRazorpayPlanCurrency}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored in paise — 50000 = ₹500.00. Students see the equivalent
              rupee amount on the pricing card and checkout flow.
            </p>
          </section>

          {/* WhatsApp section */}
          <section className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp reminder template
            </div>
            <Field label="Template name">
              <Input
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                placeholder="yoga_class_reminder_v1"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              The provider uses this template name when sending the
              15-minute pre-class reminder.
            </p>
          </section>

          {/* Worker timing section */}
          <section className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Class generator timing
            </div>
            <Field
              label="Look-ahead days"
              hint="1 – 30"
            >
              <Input
                type="number"
                inputMode="numeric"
                value={lookAheadDays}
                onChange={(e) => setLookAheadDays(e.target.value)}
                min={1}
                max={30}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              How many days ahead the worker generates YogaClass rows +
              Google Meet events when it runs.
            </p>

            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground pt-2">
              <Bell className="h-3.5 w-3.5" />
              Reminder dispatch timing
            </div>
            <Field
              label="Minutes before class"
              hint="1 – 180"
            >
              <Input
                type="number"
                inputMode="numeric"
                value={reminderMinutesBefore}
                onChange={(e) => setReminderMinutesBefore(e.target.value)}
                min={1}
                max={180}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              WhatsApp reminders are queued this many minutes before each
              class start time.
            </p>
          </section>

          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <Button
              disabled={!valid || isPending}
              onClick={() =>
                onSave({
                  razorpayPlanId: razorpayPlanId.trim(),
                  razorpayPlanAmount: parseInt(razorpayPlanAmount, 10),
                  razorpayPlanCurrency,
                  whatsappTemplate: whatsappTemplate.trim(),
                  lookAheadDays: parseInt(lookAheadDays, 10),
                  reminderMinutesBefore: parseInt(reminderMinutesBefore, 10),
                })
              }
            >
              {isPending ? <Spinner /> : <Save className="h-4 w-4" />}
              Save settings
            </Button>
            <Button
              variant="outline"
              disabled={!dirty || isPending}
              onClick={() => {
                setRazorpayPlanId(initial.razorpayPlanId);
                setRazorpayPlanAmount(String(initial.razorpayPlanAmount));
                setRazorpayPlanCurrency(initial.razorpayPlanCurrency);
                setWhatsappTemplate(initial.whatsappTemplate);
                setLookAheadDays(String(initial.lookAheadDays));
                setReminderMinutesBefore(String(initial.reminderMinutesBefore));
              }}
            >
              <RefreshCw className="h-4 w-4" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview side card */}
      <Card className="border-border/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <p className="font-medium">Pricing preview</p>
          </div>
          <div className="rounded-lg bg-brand-gradient text-primary-foreground p-5">
            <p className="text-xs opacity-80">Monthly membership</p>
            <p className="text-3xl font-bold tracking-tight">
              {formatINR(parseInt(razorpayPlanAmount, 10) || 0)}
            </p>
            <p className="text-xs opacity-80 mt-1">
              {razorpayPlanCurrency} · billed monthly
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-mono text-xs">{razorpayPlanId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Look-ahead</span>
              <span className="font-medium">{lookAheadDays} days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reminder</span>
              <span className="font-medium">
                {reminderMinutesBefore} min before
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
