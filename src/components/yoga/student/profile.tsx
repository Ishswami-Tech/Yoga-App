"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiGet, apiPatch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Phone,
  MessageSquare,
  User as UserIcon,
  Save,
  CalendarDays,
  ShieldCheck,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorCard } from "./shared";
import { prettyDate } from "./format";
import { SunFan } from "../art/sunrise";

type Profile = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  whatsappNumber: string | null;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  createdAt: string;
};

export function ProfileView() {
  const qc = useQueryClient();
  const q = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiGet<Profile>("/api/profile"),
    retry: false,
  });

  if (q.isLoading) return <ProfileSkeleton />;
  if (q.isError)
    return (
      <ErrorCard
        message={(q.error as any)?.message ?? "Couldn't load your profile."}
        onRetry={() => qc.invalidateQueries({ queryKey: ["profile"] })}
      />
    );
  if (!q.data) return null;

  // Key the form on the loaded data so a save-driven refetch remounts it
  // with the new saved values (no setState-in-effect needed).
  const formKey = `${q.data.id}:${q.data.name ?? ""}:${q.data.phone ?? ""}:${
    q.data.whatsappNumber ?? ""
  }`;

  return (
    <div className="space-y-4">
      <header className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-sunrise-sky p-5 text-[#3B1F1A] shadow-lift">
        <SunFan
          size={200}
          className="pointer-events-none absolute -right-16 -top-20"
        />
        <div
          aria-hidden="true"
          className="relative grid size-[72px] shrink-0 place-items-center rounded-full border-4 border-card bg-[#F7C9B6] font-display text-2xl font-bold shadow-[0_0_0_3px_#F5A623]"
        >
          {(q.data.name ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("") || "?"}
        </div>
        <div className="relative min-w-0">
          <h1 className="font-display text-3xl font-semibold leading-tight break-words">
            {q.data.name || "Profile"}
          </h1>
          <div className="mt-2 inline-flex items-center rounded-full bg-card px-3 py-1 text-[12.5px] font-extrabold">
            {q.data.role.charAt(0) + q.data.role.slice(1).toLowerCase()}, member since{" "}
            {prettyDate(q.data.createdAt.slice(0, 10))}
          </div>
        </div>
      </header>
      <p className="text-sm text-muted-foreground px-1">
        Keep your contact details current. WhatsApp reminders are sent to
        the number below.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProfileForm key={formKey} profile={q.data} />
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="font-display text-lg font-semibold">Account</p>
            </div>
            <Row icon={Mail} label="Email" value={q.data.email} />
            <Row
              icon={UserIcon}
              label="Role"
              value={q.data.role.toLowerCase()}
            />
            <Row
              icon={CalendarDays}
              label="Member since"
              value={prettyDate(q.data.createdAt.slice(0, 10))}
            />
            <div className="pt-2 border-t-2 border-dotted border-border text-xs text-muted-foreground">
              <p>
                Your email is your login identity and cannot be changed here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const { user, set } = useApp();
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const whatsapp = profile.whatsappNumber ?? "";

  const saveMut = useMutation({
    mutationFn: () =>
      apiPatch<Profile>("/api/profile", {
        name,
        phone: phone || null,
      }),
    onSuccess: (u) => {
      toast.success("Profile updated");
      // Keep the global user in sync so the header shows the new name.
      if (user) {
        set({
          user: { id: u.id, email: u.email, name: u.name, role: u.role },
        });
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: ApiError | Error) =>
      toast.error((e as ApiError)?.message ?? "Couldn't save profile"),
  });

  const dirty =
    name !== (profile.name ?? "") ||
    phone !== (profile.phone ?? "");

  return (
    <Card className="md:col-span-2 rounded-3xl shadow-soft">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <UserIcon className="h-4 w-4 text-primary" />
          <p className="font-display text-lg font-semibold">Account details</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            <Phone className="h-3.5 w-3.5" /> Phone
          </Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            inputMode="tel"
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">
            Optional · for account recovery
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp">
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp number
          </Label>
          <Input
            id="whatsapp"
            value={whatsapp}
            readOnly
            disabled
            placeholder="+91 98765 43210"
            inputMode="tel"
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">
            This is your sign-in number and where class reminders go. Contact support to change it.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            size="lg"
            disabled={!dirty || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save changes
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={!dirty || saveMut.isPending}
            onClick={() => {
              setName(profile.name ?? "");
              setPhone(profile.phone ?? "");
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="text-base font-extrabold truncate">{value}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-7 w-32 rounded-md bg-accent animate-pulse" />
        <div className="h-4 w-72 rounded-md bg-accent animate-pulse" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="md:col-span-2 h-72 rounded-3xl bg-accent animate-pulse" />
        <div className="h-72 rounded-3xl bg-accent animate-pulse" />
      </div>
    </div>
  );
}
