# Task 8 — AdminApp-subagent work record

Build the AdminApp (admin console) for the Live Yoga Membership Platform. Full work record appended to `/home/z/my-project/worklog.md` under "Task ID: 8".

## Files created (all under `src/components/yoga/admin/`)
- `shared.tsx` — semantic StatusBadge, ExceptionTypeBadge, RoleBadge, PageHeader, LoadingCard, EmptyState, ErrorCard, Spinner, MonoText, CopyButton, RevealText, and IST helpers (istDate/istTime/istDateTime/todayIST).
- `dashboard.tsx` — brand-gradient revenue hero + 8-up KPI grid + 7-day upcoming list + recent webhook events + worker quick actions (generate/remind/retry) + 4-up quick-link grid. Auto-refreshes every 60s.
- `users.tsx` — `UsersView({ role })` component used for both `admin-users` (STUDENT) and `admin-instructors` (INSTRUCTOR). Debounced search, full table, dropdown actions, Add (keyed) + Edit (keyed) + Delete (AlertDialog) dialogs. POST/PATCH/DELETE wired with toast feedback and dashboard invalidation.
- `subscriptions.tsx` — status filter, table of subscriptions, "Simulate recurring charge" row action (POST `/api/subscriptions/simulate`).
- `payments.tsx` — optional user filter, 4-up summary cards (captured/fees/pending/failed via `useMemo`), payments table.
- `schedules.tsx` — schedule cards with weekday chips, Add/Edit dialogs (keyed), Delete confirm. POST/PATCH/DELETE wired.
- `exceptions.tsx` — schedule select filter, table of exceptions with delete, Add dialog (schedule select, date input, type select, reason textarea, amber NO_CLASS warning).
- `classes.tsx` — status + schedule filters, table of generated classes with click-to-expand detail rows, "Generate now" + "Send reminders" top actions. Rows wrapped in `<Fragment key={c.id}>`.
- `whatsapp.tsx` — status filter, WhatsApp logs table, "Retry failed" top action, failed-count banner.
- `audit.tsx` — entityType filter, audit table with per-entity icons and pretty-printed JSON metadata.
- `settings.tsx` — 2-col form + live pricing-preview card. Save via PUT using the lower-level `api` helper (api-client.ts has no `apiPut`).
- `app.tsx` — `AdminApp` named export. AppShell with brand "Prana Live Yoga", role ADMIN, 11 nav items, switches on store view.

## Lint / compile / runtime checks
- `bun run lint` -> 0 errors (only 2 pre-existing warnings in `src/app/page.tsx` which is off-limits).
- Caught one compile error during dev: `settings.tsx` imported `apiPut` which doesn't exist in `api-client.ts`. Fixed by switching to `api("/api/admin/settings", { method: "PUT", body: JSON.stringify(...) })`.
- `GET /` -> HTTP 200 after the fix.
- Smoke-tested every admin endpoint with a logged-in admin@yoga.demo cookie — all return 200 with the shapes the views are typed against.
- Triggered `POST /api/admin/classes/generate?job=generate` to seed real data; the audit log immediately recorded a `WORKER_RUN` entry and the classes list now shows 3 READY rows with deterministic meet URLs.

## Key design decisions
- **Status badges semantic map**: emerald=ACTIVE/READY/SENT/DELIVERED/PROCESSED/CAPTURED, amber=PENDING/PENDING_MEET/PROCESSING, rose=FAILED/CANCELLED/HALTED/EXPIRED/DISABLED, muted=IGNORED/COMPLETED/REFUNDED. Single shared `StatusBadge` component covers all admin views.
- **IST timestamps**: `istDate` / `istTime` / `istDateTime` in shared.tsx convert ISO strings to IST (UTC+5:30, no DST) by computing UTC parts from `Date#getTime() + 5.5h`. Same approach as student/format but used for ISO timestamps rather than `YYYY-MM-DD`/`HH:mm` strings.
- **Keyed-child dialog pattern** (borrowed from student/profile.tsx): every form-based dialog uses `<InnerForm key={addKey-or-userId} ... />` so opening the dialog with fresh data remounts the form. No setState-in-effect, no `useEffect` initialization.
- **No `apiPut` workaround**: rather than touch `src/lib/api-client.ts` (off-limits), `settings.tsx` calls the lower-level `api` helper directly with `{ method: "PUT", body: JSON.stringify(...) }`.
- **Reusable `UsersView`**: students + instructors share one component parameterised by `role`/`title`/`singularLabel`. The "Add" dialog defaults the role select to the parent's role so adding an instructor from the Instructors view stays scoped.
- **Per-view auto-refresh**: every list query has `refetchInterval: 60s` so admins always see fresh data without manual refresh.
- **Brand palette**: only emerald/sage + warm amber + rose destructive. No indigo or blue anywhere.
