"use client";
import { APP_NAME } from "@/lib/brand";
import { AppShell, useMe } from "@/components/yoga/app-shell";
import { useApp, View } from "@/lib/store";
import { ViewTransition } from "@/components/yoga/view-transition";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarClock,
  CreditCard,
  Receipt,
  User,
  Flame,
  Star,
} from "lucide-react";
import { DashboardView } from "./dashboard";
import { TodayView } from "./today";
import { UpcomingView } from "./upcoming";
import { MembershipView } from "./membership";
import { PaymentsView } from "./payments";
import { ProfileView } from "./profile";
import { JournalView } from "./journal";
import { FeedbackHistoryView } from "./feedback-history";

const navItems = [
  { view: "student-dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
  { view: "student-today" as View, label: "Today", icon: CalendarCheck },
  { view: "student-upcoming" as View, label: "Upcoming", icon: CalendarClock },
  { view: "student-journal" as View, label: "Journal", icon: Flame },
  { view: "student-feedback" as View, label: "Feedback", icon: Star },
  { view: "student-membership" as View, label: "Membership", icon: CreditCard },
  { view: "student-payments" as View, label: "Payments", icon: Receipt },
  { view: "student-profile" as View, label: "Profile", icon: User },
];

export function StudentApp() {
  // Keeps the ["me"] query warm so user/membership stay fresh across views.
  useMe();
  const { view } = useApp();

  return (
    <AppShell brand={APP_NAME} role="STUDENT" navItems={navItems}>
      <ViewTransition view={view}>
        {view === "student-dashboard" && <DashboardView />}
        {view === "student-today" && <TodayView />}
        {view === "student-upcoming" && <UpcomingView />}
        {view === "student-journal" && <JournalView />}
        {view === "student-feedback" && <FeedbackHistoryView />}
        {view === "student-membership" && <MembershipView />}
        {view === "student-payments" && <PaymentsView />}
        {view === "student-profile" && <ProfileView />}
      </ViewTransition>
    </AppShell>
  );
}
