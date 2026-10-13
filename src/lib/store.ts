"use client";
import { create } from "zustand";

export type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN" | null;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Exclude<Role, null>;
};

export type MembershipSummary = {
  state:
    | "NONE"
    | "PENDING"
    | "ACTIVE"
    | "EXPIRED"
    | "HALTED"
    | "CANCELLED";
  subscriptionId: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  amount: number | null;
  currency: string | null;
  hasActive: boolean;
};

export type View =
  | "landing"
  | "login"
  | "register"
  | "checkout"
  | "student-dashboard"
  | "student-today"
  | "student-upcoming"
  | "student-membership"
  | "student-payments"
  | "student-profile"
  | "student-journal"
  | "student-feedback"
  | "instructor-dashboard"
  | "instructor-schedule"
  | "instructor-roster"
  | "instructor-history"
  | "admin-dashboard"
  | "admin-users"
  | "admin-instructors"
  | "admin-subscriptions"
  | "admin-payments"
  | "admin-schedules"
  | "admin-exceptions"
  | "admin-calendar"
  | "admin-classes"
  | "admin-whatsapp"
  | "admin-bulk-message"
  | "admin-audit"
  | "admin-analytics"
  | "admin-settings"
  | "admin-pricing";

type State = {
  user: SessionUser | null;
  membership: MembershipSummary | null;
  view: View;
  authOpen: "login" | "register" | null;
  set: (s: Partial<State>) => void;
  setView: (v: View) => void;
  openAuth: (mode: "login" | "register") => void;
  closeAuth: () => void;
};

const roleDefaultView = (role: Exclude<Role, null>): View => {
  if (role === "ADMIN") return "admin-dashboard";
  if (role === "INSTRUCTOR") return "instructor-dashboard";
  return "student-dashboard";
};

export const useApp = create<State>((set) => ({
  user: null,
  membership: null,
  view: "landing",
  authOpen: null,
  set: (s) => set(s),
  setView: (v) => {
    if (typeof window !== "undefined") {
      window.location.hash = v;
    }
    set({ view: v });
  },
  openAuth: (mode) => set({ authOpen: mode }),
  closeAuth: () => set({ authOpen: null }),
}));

export function loginViewForRole(role: Exclude<Role, null>): View {
  return roleDefaultView(role);
}

// Read the initial view from the URL hash so deep links work.
export function initViewFromHash(): View {
  if (typeof window === "undefined") return "landing";
  const h = window.location.hash.replace(/^#/, "");
  const known: View[] = [
    "landing",
    "login",
    "register",
    "checkout",
    "student-dashboard",
    "student-today",
    "student-upcoming",
    "student-membership",
    "student-payments",
    "student-profile",
    "student-journal",
    "student-feedback",
    "instructor-dashboard",
    "instructor-schedule",
    "instructor-roster",
    "instructor-history",
    "admin-dashboard",
    "admin-users",
    "admin-instructors",
    "admin-subscriptions",
    "admin-payments",
    "admin-schedules",
    "admin-exceptions",
    "admin-calendar",
    "admin-classes",
    "admin-whatsapp",
    "admin-bulk-message",
    "admin-audit",
    "admin-analytics",
    "admin-settings",
    "admin-pricing",
  ];
  return (known as string[]).includes(h) ? (h as View) : "landing";
}
