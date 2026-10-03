# Task 7 — InstructorApp-subagent

## Scope
Built the InstructorApp — three instructor-only views (dashboard, weekly
schedule + exceptions, class history) rendered inside the shared AppShell.
All work was confined to `src/components/yoga/instructor/`.

## Files
- `src/components/yoga/instructor/shared.tsx` — ClassStatusBadge, ExceptionTypeBadge,
  LoadingCard, EmptyState, ErrorCard, Spinner, KV, and IST helpers
  (`todayIST`, `nowISTTime`, `todayISTWeekday`).
- `src/components/yoga/instructor/dashboard.tsx` — DashboardHero with brand
  gradient + "Start today's class" / "Open today's Meet" CTA, 3-up quick-stats
  row (today / next 7 days / last 7 days), today's classes list with status +
  reminderSent indicator + open-meet + copy-link buttons, upcoming-this-week
  preview (top 5), rest-day empty state when no class today.
- `src/components/yoga/instructor/schedule.tsx` — Today's IST date header
  ("Mon, 22 Sep 2025 · 7:00 AM IST"), recurring weekly schedules with weekday
  chips (active days = emerald, today's weekday gets an amber ring),
  start/end time, active/paused badge, classes-generated count, exceptions
  count. Holiday & special-day exceptions list (upcoming + past, NO_CLASS vs
  SPECIAL badge, with reason). Amber note: "Ask an admin to change the weekly
  schedule or add holiday exceptions."
- `src/components/yoga/instructor/history.tsx` — Past classes table on
  desktop (Date, Time, Schedule, Status, Meet link) with click-to-expand
  detail rows (Class ID, Meet URL with copy + open buttons). Mobile cards.
  Semantic status badges: READY=emerald, COMPLETED=secondary, PENDING_MEET=
  amber, CANCELLED=muted strike, FAILED=rose. Summary pills for completed /
  cancelled / failed counts.
- `src/components/yoga/instructor/app.tsx` — InstructorApp named export that
  wraps AppShell (brand "Prana Live Yoga", role INSTRUCTOR) with 3 nav items
  (Dashboard, Schedule, Class History). Calls `useMe()` to keep the session
  warm and switches on the store view.

## Patterns
- Each view returns loading skeleton → error state (with retry) → empty
  state → populated render. Queries use `retry: false` and `refetchInterval`
  where appropriate (dashboard class data refreshes every 60s).
- Reuses `@/components/yoga/student/format` (`prettyTime`, `prettyDate`,
  `shortDate`, `classPhase`, `relativeToStart`, `greeting`) and the same
  emerald/sage + warm-amber brand palette as the StudentApp.
- TanStack Query cache keys: `["instructor","classes"]` (dashboard + history
  share), `["admin","schedules"]`, `["admin","exceptions"]`. Toasts via
  `sonner` for open-meet / copy-link feedback.
- No indigo or blue anywhere. Mobile-first responsive (3-up stats collapse,
  tables switch to cards on mobile, hero stacks vertically).
- Sticky header + sidebar + mobile bottom nav + sticky footer all provided
  by AppShell.

## Verification
- `bun run lint` → 0 errors. Only 2 pre-existing warnings in
  `src/app/page.tsx` (this task did not touch that file).
- `GET /` → 200 with and without an instructor session cookie.
- Smoke-tested `/api/instructor/classes`, `/api/admin/schedules`, and
  `/api/admin/exceptions` with a logged-in `instructor@yoga.demo` cookie;
  all return 200 with the data shapes the views are typed against.

## Did NOT touch
- `src/app/page.tsx`, `src/lib/*`, `src/components/yoga/app-shell.tsx`,
  `src/components/ui/*`, all API routes, and server-side lib files.
