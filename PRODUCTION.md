# Production deploy guide: Vercel + Neon/Supabase

Stack: Next.js 16 on Vercel, Prisma + managed PostgreSQL, Razorpay (payments), Meta WhatsApp Cloud API (reminders and login OTP), Google Calendar API (Meet links). All of these are real integrations; there are no simulated providers and no demo data in production.

## 1. Database

1. Create a Neon or Supabase Postgres project.
2. Set `DATABASE_URL` to the pooled connection string:
   - Neon: the "pooled connection" string (host contains `-pooler`).
   - Supabase: the transaction pooler string (port 6543) plus `?pgbouncer=true&connection_limit=1`.
3. Migrations run automatically in `vercel-build` (`prisma generate && prisma migrate deploy && next build`). If `migrate deploy` hangs on a pooled URL (advisory locks), set `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` in Vercel, or run `DATABASE_URL=<direct url> bunx prisma migrate deploy` once from your machine. We deliberately do not use a `directUrl` in the schema so existing setups keep working.
4. Never run `db push --accept-data-loss` or `db:seed` against production (the seed refuses to run).

## 2. Environment variables (names only; values go in Vercel Project Settings)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Postgres connection |
| `AUTH_SECRET` | yes | Session signing, at least 32 chars |
| `NEXT_PUBLIC_APP_URL` | yes | Public https URL of the app |
| `CRON_SECRET` | yes | Bearer secret for `/api/workers/run` (Vercel Cron sends it automatically) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | yes | Razorpay API |
| `RAZORPAY_WEBHOOK_SECRET` | yes | Verifies `/api/webhooks/razorpay` |
| `META_WA_ACCESS_TOKEN`, `META_WA_PHONE_NUMBER_ID` | yes | WhatsApp Cloud API |
| `META_WA_OTP_TEMPLATE`, `META_WA_OTP_LANGUAGE` | no | OTP template name/language (default `otp_login` / `en`) |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN` | yes | Creates Meet links |
| `GOOGLE_CALENDAR_ID` | no | Calendar to use (default `primary`) |
| `SUPER_ADMIN_EMAILS` | no | Emails allowed to change the price |
| `NEXT_PUBLIC_APP_NAME` | no | Brand name (default `Vishwayog`) |
| `NEXT_PUBLIC_SUPPORT_PHONE`, `SUPPORT_PHONE`, `NEXT_PUBLIC_SUPPORT_EMAIL` | no | Support contact shown in footer and receipts |
| `DEFAULT_COUNTRY_CODE` | no | Default `91` |

`GET /api/health` reports (booleans and variable names only) which integrations are configured and whether the database answers. A missing variable never breaks the build; it shows up as `status: "degraded"` with `missingEnv`.

## 3. Razorpay dashboard

1. Generate Key ID and Key Secret (Settings, API Keys) for Live mode.
2. Settings, Webhooks, Add new webhook:
   - URL: `https://<your-domain>/api/webhooks/razorpay`
   - Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed` (enable at least the events your checkout flow uses; unhandled events are ignored).
3. The webhook returns 503 if the secret is missing and 401 on a bad signature.

## 4. Meta WhatsApp Cloud API

1. Create a WhatsApp Business account and phone number; copy the permanent system-user access token and the Phone Number ID.
2. Create and get approved:
   - `yoga_class_reminder_v1` (Utility), language `en`, body with 3 variables: `{{1}}` student name, `{{2}}` class time, `{{3}}` Meet link.
   - `otp_login` (Authentication) with the one-time-code button.
3. Students must have a WhatsApp number on their profile to receive reminders and to log in.

## 5. Google Calendar OAuth refresh token

1. Google Cloud Console: create a project, enable the Google Calendar API, configure the OAuth consent screen (publish to "In production" so the refresh token does not expire after 7 days).
2. Create an OAuth client (type Web) with redirect URI `https://developers.google.com/oauthplayground`.
3. In OAuth Playground, gear icon, tick "Use your own OAuth credentials", enter the client id and secret, authorise scope `https://www.googleapis.com/auth/calendar.events` with the Google account that will host the classes, then "Exchange authorization code for tokens" and copy the refresh token.
4. Set `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN`.

If these are missing or Google rejects the call, the class is marked `FAILED` with a readable `errorMessage`, a critical notification appears for admins, and the `generate` job retries it every 15 minutes. A fake Meet link is never created.

## 6. Scheduled jobs (Vercel Cron)

`vercel.json` defines two crons that call `/api/workers/run`:

| Job | Schedule | Does |
|---|---|---|
| `remind` | `* * * * *` (every minute) | Sends due WhatsApp reminders; every 5th minute also retries failed sends |
| `generate` | `*/15 * * * *` | Creates classes for the look-ahead window and their Meet links; retries FAILED/PENDING_MEET classes |

Vercel Cron sends `GET` with `Authorization: Bearer $CRON_SECRET` (Vercel adds this when `CRON_SECRET` is set as a project env var). An ADMIN session can also trigger `GET/POST /api/workers/run?job=generate|remind|retry`. Query-string secrets are not accepted. Both jobs are idempotent and stop after about 45 s (route `maxDuration = 60`).

Plan note: Vercel Hobby only allows daily crons and rejects per-minute schedules at deploy time. **Vercel Pro is required** for reliable reminders. The optional self-host runner `mini-services/yoga-worker` (needs `CRON_SECRET` and `WORKER_BASE_URL`; `bun mini-services/yoga-worker/index.ts`) can call the same endpoint from any always-on machine if you cannot use Pro crons.

## 7. First deploy and first admin

1. Import the repo in Vercel, set all env vars for Production, deploy (the build command is `vercel-build`; set Build Command to `bun run vercel-build` or `npm run vercel-build` if it is not picked up automatically).
2. Create the first admin from your machine (the DB must be reachable):
   ```bash
   BOOTSTRAP_ADMIN_NAME="Your Name" BOOTSTRAP_ADMIN_PHONE="+91XXXXXXXXXX" \
   BOOTSTRAP_ADMIN_EMAIL="you@example.com" DATABASE_URL="<url>" bun run db:bootstrap
   ```
   This is idempotent and also creates default settings (`razorpayPlanAmount` 150000 paise, `lookAheadDays` 3, `reminderMinutesBefore` 15, `whatsappTemplate`). Log in with a WhatsApp OTP on that number.
3. Add the class schedule in the admin console.

## 8. Post-deploy smoke checklist

- [ ] `GET /api/health` returns `status: "ok"`, `missingEnv: []`, all integrations true.
- [ ] Log in as admin via WhatsApp OTP.
- [ ] Vercel, Settings, Cron Jobs shows both crons; trigger `generate`; classes appear with Meet links (status READY).
- [ ] Make a small live payment; webhook delivery shows 200 in Razorpay; membership becomes ACTIVE; receipt opens.
- [ ] A reminder arrives on WhatsApp for an upcoming class; admin notifications bell shows no critical items.
- [ ] Security headers present (CSP, HSTS) and Razorpay checkout opens without CSP errors in the browser console.

## 9. Rollback

- App: Vercel, Deployments, previous deployment, "Promote to Production" (instant). Env var changes need a redeploy.
- Database: migrations are forward-only. The latest one (`yogaclass_error_message`) only adds a nullable column, so rolling the app back is safe. Take a Neon branch / Supabase backup before releasing a migration that drops or alters data.
- Disable reminders quickly by removing the crons from `vercel.json` and redeploying, or rotating `CRON_SECRET`.

## Local development

```bash
bun install
bun run db:dev                 # local Postgres on :54329
cp .env.example .env           # fill DATABASE_URL, AUTH_SECRET
bunx prisma migrate deploy
bun run db:seed                # dev-only demo data
bun run dev
```

Tests: `bun run test:unit`, `bun run test:api` (needs dev server), `bunx playwright test`.
