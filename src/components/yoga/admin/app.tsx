"use client";
import { AppShell, useMe } from "@/components/yoga/app-shell";
import { useApp, View } from "@/lib/store";
import { ViewTransition } from "@/components/yoga/view-transition";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  RefreshCw,
  IndianRupee,
  CalendarDays,
  CalendarOff,
  Video,
  MessageCircle,
  ScrollText,
  Settings,
  BarChart3,
  CalendarRange,
  Send,
} from "lucide-react";
import { DashboardView } from "./dashboard";
import { UsersView } from "./users";
import { SubscriptionsView } from "./subscriptions";
import { PaymentsView } from "./payments";
import { SchedulesView } from "./schedules";
import { ExceptionsView } from "./exceptions";
import { CalendarView } from "./calendar";
import { ClassesView } from "./classes";
import { WhatsAppView } from "./whatsapp";
import { AuditView } from "./audit";
import { AnalyticsView } from "./analytics";
import { SettingsView } from "./settings";
import { BulkMessageView } from "./bulk-message";

const navItems = [
  { view: "admin-dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
  { view: "admin-users" as View, label: "Students", icon: Users },
  { view: "admin-instructors" as View, label: "Instructors", icon: GraduationCap },
  { view: "admin-subscriptions" as View, label: "Subscriptions", icon: RefreshCw },
  { view: "admin-payments" as View, label: "Payments", icon: IndianRupee },
  { view: "admin-schedules" as View, label: "Schedules", icon: CalendarDays },
  { view: "admin-calendar" as View, label: "Calendar", icon: CalendarRange },
  { view: "admin-exceptions" as View, label: "Exceptions", icon: CalendarOff },
  { view: "admin-classes" as View, label: "Classes", icon: Video },
  { view: "admin-whatsapp" as View, label: "WhatsApp Logs", icon: MessageCircle },
  { view: "admin-bulk-message" as View, label: "Bulk Message", icon: Send },
  { view: "admin-analytics" as View, label: "Analytics", icon: BarChart3 },
  { view: "admin-audit" as View, label: "Audit Log", icon: ScrollText },
  { view: "admin-settings" as View, label: "Settings", icon: Settings },
];

export function AdminApp() {
  // Keeps the ["me"] query warm so the store user/membership stay fresh
  // across admin views.
  useMe();
  const { view } = useApp();

  return (
    <AppShell brand="Prana Live Yoga" role="ADMIN" navItems={navItems}>
      <ViewTransition view={view}>
        {view === "admin-dashboard" && <DashboardView />}
        {view === "admin-users" && (
          <UsersView
            role="STUDENT"
            title="Students"
            description="Everyone enrolled in the membership programme."
            singularLabel="Student"
            icon={<Users className="h-4 w-4" />}
          />
        )}
        {view === "admin-instructors" && (
          <UsersView
            role="INSTRUCTOR"
            title="Instructors"
            description="Teachers who run the daily classes."
            singularLabel="Instructor"
            icon={<GraduationCap className="h-4 w-4" />}
          />
        )}
        {view === "admin-subscriptions" && <SubscriptionsView />}
        {view === "admin-payments" && <PaymentsView />}
        {view === "admin-schedules" && <SchedulesView />}
        {view === "admin-calendar" && <CalendarView />}
        {view === "admin-exceptions" && <ExceptionsView />}
        {view === "admin-classes" && <ClassesView />}
        {view === "admin-whatsapp" && <WhatsAppView />}
        {view === "admin-bulk-message" && <BulkMessageView />}
        {view === "admin-analytics" && <AnalyticsView />}
        {view === "admin-audit" && <AuditView />}
        {view === "admin-settings" && <SettingsView />}
      </ViewTransition>
    </AppShell>
  );
}
