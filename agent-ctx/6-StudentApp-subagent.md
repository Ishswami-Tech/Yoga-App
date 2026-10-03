# Task 6 — StudentApp

**Agent:** StudentApp-subagent
**Task:** Build the StudentApp for the Live Yoga Membership Platform (6 views, full UX).

## Files created (all under `src/components/yoga/student/`)
- `format.ts` — client-side formatting helpers: `prettyTime` ("07:00" → "7:00 AM"),
  `prettyDate` / `shortDate` (UTC-part-safe, no TZ drift), `formatINR` (paise → ₹X.XX),
  `istEpoch`, `classPhase`, `relativeToStart` ("starts in 45 min" / "live now"),
  `greeting` (IST-aware).
- `shared.tsx` — `MembershipStateBadge` (semantic colours per state),
  `LoadingCard`, `EmptyState`, `ErrorCard`, `Spinner`, `KV` row.
- `dashboard.tsx` — `DashboardView`: gradient "Daily ritual" hero with greeting +
  name + today's class time + Join/Subscribe CTA + live/starts-in chip + reminder
  chip; 3-up grid (Membership state / Today / Next up); 4 quick-link cards.
- `today.tsx` — `TodayView`: hero class card with live/starts-in indicator,
  big green "Join Class on Google Meet" button (or "Subscribe to join" CTA when
  membership-required), details grid, membership-required banner, helper note.
  404 from `/api/classes/today` is treated as a rest-day empty state (not an
  error).
- `upcoming.tsx` — `UpcomingView`: 7-day list as a desktop table +
  mobile cards; per-row status badge (Ready / Meet pending) + Join / Members-only
  button; empty state.
- `membership.tsx` — `MembershipView`: live subscription card for ACTIVE
  (start / next billing / amount / Razorpay ID + "Manage via Razorpay" disabled
  note), PENDING spinner card, EXPIRED/HALTED/CANCELLED banner, and the full
  inline subscribe flow: Pricing → Checkout → Processing (polls
  `/api/subscription` until ACTIVE, Progress bar) → Success. Invalidates `["me"]`,
  `["subscription"]`, and class queries on success so the whole app refreshes.
- `payments.tsx` — `PaymentsView`: desktop table + mobile cards, total-paid
  summary, semantic status badges (captured/pending/failed/refunded), fee column.
- `profile.tsx` — `ProfileView`: editable name/phone/whatsappNumber form using
  a key-remounted `ProfileForm` child (avoids setState-in-effect lint error),
  save via `PATCH /api/profile`, toast feedback, read-only account side card
  (email / role / member since). Keeps the global store `user` in sync on save.
- `app.tsx` — `StudentApp` (named export): wraps `AppShell` with
  `brand="Prana Live Yoga"`, `role="STUDENT"`, 6 nav items (LayoutDashboard,
  CalendarCheck, CalendarClock, CreditCard, Receipt, User icons) and switches
  on the store `view`. Calls `useMe()` to keep the `["me"]` query warm so
  user/membership stay fresh across views (page.tsx's bootstrap effect syncs
  the store whenever the query refetches).

## Design
- Brand emerald/sage + warm amber palette throughout (no indigo/blue).
- Responsive: mobile-first, cards stack on mobile, grids on desktop, mobile
  bottom nav via AppShell.
- Every view: loading (skeleton), empty state, error state (with retry).
- Status badges: ACTIVE→emerald, PENDING→amber, EXPIRED/HALTED/CANCELLED→rose,
  NONE→muted.
- sonner toasts for save/subscribe/verify feedback.

## Verification
- `bun run lint` — 0 errors (only 2 pre-existing warnings in `src/app/page.tsx`
  which this task was not permitted to touch).
- `GET /` → 200 (dev server still healthy after edits).
- Manually exercised the student API surface with a logged-in `priya@student.demo`
  cookie: `/api/classes/today` (404 → rest-day empty state handled),
  `/api/classes/upcoming?days=7`, `/api/subscription` (ACTIVE),
  `/api/payments` (1 captured ₹500.00 payment), `/api/profile`.

## Notes / issues
- None. The StudentApp is fully wired and renders for any logged-in STUDENT
  role. The store's `membership` stays fresh because page.tsx's bootstrap
  `useQuery(["me"])` is invalidated on subscribe success and re-syncs the
  store via its existing `useEffect`.
- Did not modify any file outside `src/components/yoga/student/`.
