"use client";
import { Mail, MessageCircle } from "lucide-react";

export type Method = "phone" | "email";

const TABS: { id: Method; label: string; Icon: typeof Mail }[] = [
  { id: "phone", label: "Phone", Icon: MessageCircle },
  { id: "email", label: "Email", Icon: Mail },
];

/** Segmented control to pick the sign-in method. Phone is always shown. */
export function MethodTabs({
  value, onChange, emailEnabled,
}: { value: Method; onChange: (m: Method) => void; emailEnabled: boolean }) {
  const tabs = TABS.filter((t) => t.id === "phone" || emailEnabled);
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {tabs.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        );
      })}
    </div>
  );
}
