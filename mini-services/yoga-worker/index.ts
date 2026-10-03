// Yoga Worker — standalone scheduled-job runner.
//
// This mini-service owns the platform's automation:
//   - Every minute:   tick the REMINDER job for any class whose reminderAt
//                      has arrived and reminderSentAt is null. Also retry
//                      FAILED WhatsApp messages (bounded).
//   - Every 5 minutes: tick the CLASS GENERATION job so the next 1-3 days of
//                      classes always have Google Meets created ahead of time.
//
// The worker drives the platform by calling the authenticated worker endpoint
// POST /api/workers/run?job=generate|remind|retry on the Next.js app. The
// endpoint accepts either an admin session OR the CRON_SECRET query param.
//
// Per project rules: this service runs on a fixed port (3004) and exposes
// GET /health for liveness checks. All outbound requests use relative paths
// with the XTransformPort query param so the gateway can route them.

const PORT = 3004;
const APP_PORT = 3000;
const CRON_SECRET = process.env.CRON_SECRET ?? "yoga-dev-cron-secret";
const BASE = process.env.WORKER_BASE_URL ?? `http://localhost:${APP_PORT}`;

// Schedule table. `intervalMs` is the time between runs; `jitterMs` is the
// randomised offset so multiple worker instances don't synchronise.
const JOBS = [
  {
    name: "remind",
    intervalMs: 60 * 1000, // every minute
    jitterMs: 4 * 1000,
    lastRunAt: 0,
  },
  {
    name: "retry",
    intervalMs: 5 * 60 * 1000, // every 5 minutes
    jitterMs: 15 * 1000,
    lastRunAt: 0,
  },
  {
    name: "generate",
    intervalMs: 5 * 60 * 1000, // every 5 minutes
    jitterMs: 30 * 1000,
    lastRunAt: 0,
  },
] as const;

type JobName = (typeof JOBS)[number]["name"];

async function callWorker(job: JobName) {
  const url = `${BASE}/api/workers/run?XTransformPort=${APP_PORT}&secret=${encodeURIComponent(
    CRON_SECRET
  )}&job=${job}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job }),
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    const ms = Date.now() - started;
    if (!res.ok) {
      console.warn(
        `[worker] ${job} FAILED ${res.status} in ${ms}ms:`,
        data?.error ?? text
      );
      return { ok: false, status: res.status, ms, data };
    }
    console.log(
      `[worker] ${job} ok in ${ms}ms`,
      summarize(job, data?.result)
    );
    return { ok: true, status: 200, ms, data };
  } catch (e) {
    const ms = Date.now() - started;
    console.error(`[worker] ${job} network error in ${ms}ms:`, e);
    return { ok: false, status: 0, ms, error: String(e) };
  }
}

function summarize(job: JobName, result: any): string {
  if (!result) return "";
  if (job === "generate") {
    return `created=${result.createdClasses ?? 0} meets=${
      result.createdMeets ?? 0
    } holiday=${result.skippedHoliday ?? 0} errors=${result.errors?.length ?? 0}`;
  }
  if (job === "remind") {
    return `classes=${result.classesProcessed ?? 0} sent=${
      result.messagesSent ?? 0
    } failed=${result.messagesFailed ?? 0}`;
  }
  if (job === "retry") {
    return `retried=${result.retried ?? 0} recovered=${
      result.recovered ?? 0
    } stillFailing=${result.stillFailing ?? 0}`;
  }
  return JSON.stringify(result).slice(0, 160);
}

const startedAt = Date.now();

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          uptime_s: Math.floor((Date.now() - startedAt) / 1000),
          jobs: JOBS.map((j) => ({
            name: j.name,
            intervalMs: j.intervalMs,
            lastRunAgoMs: j.lastRunAt ? Date.now() - j.lastRunAt : null,
          })),
          ts: new Date().toISOString(),
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    if (url.pathname === "/run" && req.method === "POST") {
      const job = url.searchParams.get("job") as JobName | null;
      if (!job) {
        return new Response(JSON.stringify({ error: "missing job" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const result = await callWorker(job);
      return new Response(JSON.stringify(result), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("Yoga worker running. Use GET /health or POST /run?job=.", {
      status: 200,
    });
  },
});

console.log(`[worker] listening on :${PORT} (health: /health)`);
console.log(`[worker] driving app at ${BASE}`);
console.log(`[worker] jobs:`, JOBS.map((j) => `${j.name} every ${j.intervalMs / 1000}s`).join(", "));

// Tick loop.
async function tick() {
  const now = Date.now();
  for (const job of JOBS) {
    if (now - job.lastRunAt >= job.intervalMs + Math.random() * job.jitterMs) {
      job.lastRunAt = now;
      // Fire-and-forget; the callWorker promise logs its own outcome.
      callWorker(job.name).catch((e) =>
        console.error(`[worker] ${job.name} uncaught`, e)
      );
    }
  }
}

setInterval(tick, 10 * 1000);
// Also kick one immediately so the platform has fresh classes on boot.
setTimeout(() => {
  callWorker("generate")
    .then(() => callWorker("remind"))
    .catch(() => {});
}, 2000);

// Keep the process alive and log a heartbeat every minute.
setInterval(() => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  console.log(`[worker] heartbeat uptime=${uptime}s`);
}, 60 * 1000);

console.log(`[worker] server:`, server.url?.toString() ?? `http://localhost:${PORT}`);
