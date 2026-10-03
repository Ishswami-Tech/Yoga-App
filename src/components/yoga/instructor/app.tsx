"use client";
import { AppShell, useMe } from "@/components/yoga/app-shell";
import { useApp, View } from "@/lib/store";
import { ViewTransition } from "@/components/yoga/view-transition";
import {
  LayoutDashboard,
  CalendarDays,
  History as HistoryIcon,
  Users,
} from "lucide-react";
import { DashboardView } from "./dashboard";
import { ScheduleView } from "./schedule";
import { RosterView } from "./roster";
import { HistoryView } from "./history";

const navItems = [
  {
    view: "instructor-dashboard" as View,
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    view: "instructor-roster" as View,
    label: "Today's Roster",
    icon: Users,
  },
  {
    view: "instructor-schedule" as View,
    label: "Schedule",
    icon: CalendarDays,
  },
  {
    view: "instructor-history" as View,
    label: "Class History",
    icon: HistoryIcon,
  },
];

export function InstructorApp() {
  // Keeps the ["me"] query warm so the store user/membership stay fresh.
  useMe();
  const { view } = useApp();

  return (
    <AppShell brand="Prana Live Yoga" role="INSTRUCTOR" navItems={navItems}>
      <ViewTransition view={view}>
        {view === "instructor-dashboard" && <DashboardView />}
        {view === "instructor-roster" && <RosterView />}
        {view === "instructor-schedule" && <ScheduleView />}
        {view === "instructor-history" && <HistoryView />}
      </ViewTransition>
    </AppShell>
  );
}
