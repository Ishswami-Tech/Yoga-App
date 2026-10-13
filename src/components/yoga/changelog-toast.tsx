"use client";
import { APP_NAME } from "@/lib/brand";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";

// In-app changelog toast.
//
// On first load after a new version, shows a Sonner toast listing the latest
// features. The version is persisted in localStorage so the toast only fires
// once per version per browser. Bumping CHANGELOG_VERSION below triggers the
// toast on the next page load.

const CHANGELOG_VERSION = "10";
const STORAGE_KEY = "prana-yoga-changelog-seen";

const ENTRIES: { version: string; date: string; title: string; items: string[] }[] = [
  {
    version: "10",
    date: "Sep 2026",
    title: "Pause/resume membership, feedback rating trend chart",
    items: [
      "Student self-service pause/resume membership (finally implemented!)",
      "Admin feedback rating trend line chart (6-month avg rating over time)",
      "Pause dispatches the verified Razorpay halted webhook event",
      "Resume dispatches the charged event — full idempotent webhook path",
    ],
  },
  {
    version: "9",
    date: "Sep 2026",
    title: "Instructor feedback summary, student feedback history & admin feedback analytics",
    items: [
      "Instructor feedback summary card on dashboard (avg rating + recent comments)",
      "Student feedback history view (past ratings + comments)",
      "Admin class feedback analytics in Analytics view (distribution + trends)",
      "All three roles can now see and act on class feedback",
    ],
  },
  {
    version: "8",
    date: "Sep 2026",
    title: "Class feedback, student export CSV & retention cohorts",
    items: [
      "Student class feedback — rate classes 1-5 stars with optional comment",
      "Admin export students CSV (name, email, phone, membership, payments)",
      "Admin retention cohort analysis (active → churned with at-risk list)",
      "Feedback widget appears on Today's class after it ends",
    ],
  },
  {
    version: "7",
    date: "Sep 2026",
    title: "Notes editor UI, calendar click-through & revenue leaderboard",
    items: [
      "Instructor notes editor dialog (write/clear notes for attendees)",
      "Admin calendar day click-through — click any day for class details",
      "Admin revenue leaderboard with gold/silver/bronze podium",
      "All calendar day cells are now interactive with hover states",
    ],
  },
  {
    version: "6",
    date: "Sep 2026",
    title: "Schedule calendar, bulk messaging & class notes",
    items: [
      "Admin schedule calendar view — month grid with classes + exceptions",
      "Admin bulk WhatsApp message tool for announcements",
      "Instructor class notes visible to attendees on Today's class",
      "Student Today view now shows instructor notes (when present)",
    ],
  },
  {
    version: "5",
    date: "Sep 2026",
    title: "User detail drawer, instructor roster & milestone badges",
    items: [
      "Admin user detail drawer with membership, payments & attendance history",
      "Instructor 'Today's Roster' view showing who's expected + who attended",
      "Student milestone badges (First Steps, Week Warrior, Centurion, etc.)",
      "Trend-aware forecast with weighted moving average & slope projection",
    ],
  },
  {
    version: "4",
    date: "Sep 2026",
    title: "Per-student attendance picker, trend-aware forecast & notifications",
    items: [
      "Instructor per-student attendance picker dialog with search & bulk actions",
      "Trend-aware revenue forecast (weighted moving average + slope projection)",
      "Admin notifications bell with prioritised alerts (critical/warning/info)",
      "Student practice journal with 90-day attendance heatmap",
    ],
  },
  {
    version: "3",
    date: "Sep 2026",
    title: "Practice streaks, revenue forecast & CSV export",
    items: [
      "Student attendance streak tracker on the dashboard",
      "Admin revenue forecast card with MRR, 6-mo average & 3-mo projection",
      "Export analytics as CSV for accounting",
      "Instructor can record attendance for a class (all active members)",
    ],
  },
  {
    version: "2",
    date: "Sep 2026",
    title: "Live countdown, analytics & class controls",
    items: [
      "Live class countdown on student & instructor dashboards",
      "Admin Analytics view with revenue, retention & WhatsApp charts",
      "Instructor mark-complete + admin re-open class actions",
      "Admin cancel-subscription + printable payment receipts",
    ],
  },
];

export function ChangelogToast() {
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    // Delay slightly so the SonnerToaster has mounted before we fire.
    const timer = setTimeout(() => {
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        const latest = ENTRIES[0];
        if (seen === latest.version) return;
        // New version — show the toast, then persist.
        toast.custom(
          (t) => (
            <div className="w-[360px] rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              <div className="bg-brand-gradient px-4 py-3 text-primary-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-semibold text-sm">What&apos;s new · v{latest.version}</span>
                </div>
                <button
                  onClick={() => toast.dismiss(t)}
                  className="text-primary-foreground/70 hover:text-primary-foreground"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                <p className="font-medium text-sm">{latest.title}</p>
                <ul className="space-y-1">
                  {latest.items.map((item, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted-foreground pt-1">
                  {latest.date} · {APP_NAME}
                </p>
              </div>
            </div>
          ),
          { duration: 10000 }
        );
        localStorage.setItem(STORAGE_KEY, latest.version);
      } catch {
        // localStorage may be unavailable (private mode) — fail silently.
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
