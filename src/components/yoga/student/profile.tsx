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

type Profile = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  whatsappNumber: string | null;
  role: string;
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Keep your contact details current — WhatsApp reminders are sent to
          the number below.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ProfileForm key={formKey} profile={q.data} />
        <Card className="border-border/60">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="font-medium">Account</p>
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
            <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground">
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
  const [whatsapp, setWhatsapp] = useState(profile.whatsappNumber ?? "");

  const saveMut = useMutation({
    mutationFn: () =>
      apiPatch<Profile>("/api/profile", {
        name,
        phone: phone || null,
        whatsappNumber: whatsapp || null,
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
    phone !== (profile.phone ?? "") ||
    whatsapp !== (profile.whatsappNumber ?? "");

  return (
    <Card className="md:col-span-2 border-border/60">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <UserIcon className="h-4 w-4 text-primary" />
          <p className="font-medium">Account details</p>
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
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+91 98765 43210"
            inputMode="tel"
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">
            Class reminders are sent here 15 min before each class.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            className="bg-brand-gradient text-primary-foreground"
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
            disabled={!dirty || saveMut.isPending}
            onClick={() => {
              setName(profile.name ?? "");
              setPhone(profile.phone ?? "");
              setWhatsapp(profile.whatsappNumber ?? "");
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="text-sm font-medium truncate">{value}</p>
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
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 h-72 rounded-xl bg-accent animate-pulse" />
        <div className="h-72 rounded-xl bg-accent animate-pulse" />
      </div>
    </div>
  );
}
