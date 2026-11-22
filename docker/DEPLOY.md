# Container image and Temps deployment

The app ships as a multi-arch image (`linux/amd64` + `linux/arm64`) so Temps can
run it on any node in the chain temps-worker (amd64) → oracle-main (arm64) →
oracle-vm2-dss (arm64), with contabo-ds (amd64) as the last-resort fallback.

- Image: `ghcr.io/ishswami-tech/yoga-app`
- Built by: `.github/workflows/docker-image.yml` (native runners per arch, no QEMU)
- Dockerfile: `docker/Dockerfile` (Next.js `output: "standalone"`, run with `node server.js`, port 3000, non-root)

Tags: `sha-<full commit sha>` (immutable; deploy this one), `<branch>` (moving),
`latest` (main only). Pull requests build and smoke-test both platforms but push nothing.

## Build-time vs runtime configuration

`NEXT_PUBLIC_*` values are inlined by `next build`, so they are fixed per image.
The workflow passes them as build args from repository variables (Actions >
Variables) with these defaults:

| Variable | Default in the workflow | Note |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.shreevishwayogayurved.com` | Matches the live canonical URL. Temps also has it set; keep both equal. |
| `NEXT_PUBLIC_APP_NAME` | `Shree Vishwayog Ayurved` | Same as the code default. |
| `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SENTRY_DSN` | empty | Not set in Temps today either. |

Everything else (`DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, Razorpay, WhatsApp,
Google, ZeptoMail, payment bridge...) is read at runtime and stays in the Temps
environment variables exactly as now. `PORT` must remain `3000` (or unset).

Migrations are not run by the image (the current git/nextjs build does not run
them either). Run `prisma migrate deploy` from a checkout against postgres-main
before deploying an image that needs a new migration.

## Statelessness report (can it run one replica per India node?)

Yes. Nothing in the app depends on local disk or on a single process:

| Concern | Finding |
|---|---|
| Local files / uploads | No uploads, no `multipart`/`formData` handlers, no writes to disk. The only fs access is a read of `public/logo.png` for the OG image, which ships in the image. |
| Sessions / auth | Better Auth with the Prisma adapter plus the legacy `yoga_session` cookie; both store sessions in the Postgres `Session` table. Any replica can serve any request. |
| OTP / login limits | Authoritative limits are in Postgres (`OtpCode`). `src/lib/rate-limit.ts` is a per-process in-memory second layer, so with 3 replicas the IP throttle is effectively up to 3x looser (20/10 min becomes up to 60/10 min per IP). Better Auth's own default rate limiter is also in-memory. Acceptable; move to a shared store only if abuse shows up. |
| Scheduled jobs | No in-process scheduler runs: `src/lib/services/watchdog.ts` (`startWatchdog`) is not called anywhere. Jobs run only when something calls `POST/GET /api/workers/run` with `CRON_SECRET`, and each job runs under a Postgres advisory lock (`pg_try_advisory_xact_lock`) and is idempotent, so a call landing on any replica is fine and overlapping calls are skipped. The Temps environment has no cron jobs configured, yet `/api/health` reports `ok` (fresh heartbeats), so an external caller drives them today; it calls the public URL, which is unaffected by replica count. |
| Next.js caches | No ISR/`revalidate`/`unstable_cache` and no Server Actions, so no per-instance data cache or action-key mismatch. One image = one build ID on every node (with per-node git builds the build IDs could differ). |
| Database | postgres-main (HA cluster), shared by all replicas. Watch the connection count: 3 replicas x Prisma's default pool (`num_cpus * 2 + 1`). Add `connection_limit` to `DATABASE_URL` if postgres-main gets tight. |

Memory: the Temps limit is 512 MB; the standalone server is well inside that.

## Proposal: switch the Temps project to the image (not executed)

Project `vishwayog` (id 6, environment `production`, id 6) currently has
`source_type = git`, `preset = nextjs`, `replicas = 1`, `antiAffinity = true`,
`automaticDeploy = false`. Do these steps in order, one at a time, with the
user's go-ahead. Do not press "Save changes" on the environment Settings page
in the Temps UI (it unpublishes all tunnels); use the CLI.

1. **Merge this branch to main.** The workflow publishes
   `ghcr.io/ishswami-tech/yoga-app:sha-<sha>` with both platforms. Check:
   `docker buildx imagetools inspect ghcr.io/ishswami-tech/yoga-app:sha-<sha>`
   lists `linux/amd64` and `linux/arm64`.
2. **Registry access.** The repo is public, but a new GHCR package starts
   private. Either make the package public (GitHub > Packages > yoga-app >
   Package settings > Change visibility) or confirm the Temps control plane's
   GHCR credentials (already used for HealthCareBackend) can read
   `ishswami-tech/yoga-app`.
3. **Switch the source** (keeps the git link for reference):
   ```bash
   npx -y @temps-sdk/cli --target-context deploy-ishswami-in projects source -p vishwayog --type docker_image
   ```
4. **Deploy the image from the control plane**, pulling the arm64 variant first.
   Known Temps gap: Temps decides which nodes may run an image from the
   platforms present in the control plane's local image store, and its own
   pull fetches only the host platform (amd64). Without the arm64 variant held
   locally, oracle-main / oracle-vm2-dss are excluded and a one-replica-per-node
   placement fails to schedule. HealthCareBackend's CI does the same thing.
   ```bash
   IMAGE=ghcr.io/ishswami-tech/yoga-app:sha-<sha>
   ssh <control-plane> "
     set -euo pipefail
     for a in 1 2 3; do docker pull -q --platform linux/arm64 '$IMAGE' >/dev/null && break; [ \$a = 3 ] && exit 1; sleep 10; done
     npx -y @temps-sdk/cli --target-context temps-local deploy:image \
       --image '$IMAGE' -p vishwayog -e production \
       --health-check-path /robots.txt -y --timeout 600
   "
   ```
   `/robots.txt` is a cheap probe that does not touch the database. `/api/health`
   is also fine but returns `down` while postgres-main is unreachable, which
   would take every replica out at once.
5. **Verify** on www.shreevishwayogayurved.com: `/api/health` → `ok`, login,
   a checkout page, and Razorpay CSP. Roll back with `deploy:image` of the
   previous `sha-` tag, or switch the source back to `git` and redeploy.
6. **Then** the main session sets placement: target nodes `[6, 10, 11]`,
   replicas 3, and adds vishwayog to the temps-ds-fallback watcher.

Optional follow-up (after the manual flow works once): add a `deploy` job to
the workflow on `main`, copying HealthCareBackend's (`ssh` to the control plane
with `secrets.SSH_PRIVATE_KEY`, `docker pull --platform linux/arm64`, then
`deploy:image`), gated by a repository variable such as `ENABLE_TEMPS_DEPLOY`.
