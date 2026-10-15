import { db } from "@/lib/db";
import { generateClasses } from "@/lib/services/class-generator";
import { sendReminders, retryFailedMessages } from "@/lib/services/reminders";
import { heartbeatKey, parseHeartbeat, type HeartbeatInput, type JobName } from "@/lib/services/job-status";

export type { JobName };

export type RunJobResult<T> =
  | { skipped: true; reason: "already_running" }
  | { skipped: false; value: T; ms: number };

const MAX_ERROR_CHARS = 300;
const MAX_SUMMARY_CHARS = 200;

/** One line, no stack, bearer tokens redacted, capped at 300 chars. */
export function sanitizeError(e: unknown): string {
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return raw
    .split("\n")[0]
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_CHARS);
}

function summarize(value: unknown): string | undefined {
  try {
    const s = JSON.stringify(value);
    return s && s !== "null" ? s.slice(0, MAX_SUMMARY_CHARS) : undefined;
  } catch {
    return undefined;
  }
}

async function recordHeartbeat(name: JobName, hb: { ok: boolean; ms: number; error?: string; summary?: string }) {
  const value = JSON.stringify({ at: new Date().toISOString(), ...hb });
  try {
    await db.appSettings.upsert({
      where: { key: heartbeatKey(name) },
      create: { key: heartbeatKey(name), value },
      update: { value },
    });
  } catch (e) {
    // A failing heartbeat write must never mask the job outcome.
    console.error("[job-runner] heartbeat write failed", sanitizeError(e));
  }
}

/**
 * Runs `fn` under a Postgres advisory lock so overlapping cron invocations of
 * the same job do not run concurrently. The transaction only holds the lock;
 * `fn` uses the normal `db` client. Skipped runs do not touch the heartbeat.
 */
export async function runJob<T>(name: JobName, fn: () => Promise<T>): Promise<RunJobResult<T>> {
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext('job:' || ${name})) AS locked`;
      if (!rows[0]?.locked) return { skipped: true, reason: "already_running" } as const;

      const started = Date.now();
      try {
        const value = await fn();
        const ms = Date.now() - started;
        await recordHeartbeat(name, { ok: true, ms, summary: summarize(value) });
        return { skipped: false, value, ms } as const;
      } catch (e) {
        await recordHeartbeat(name, { ok: false, ms: Date.now() - started, error: sanitizeError(e) });
        throw e;
      }
    },
    // The xact lock lives exactly as long as this transaction. If the transaction timed out while a job
    // was still running, Postgres would roll back and silently release the lock. Jobs budget themselves
    // to ~45s (reminders JOB_BUDGET_MS), so the timeout sits well above that; an overrun now surfaces
    // as an error instead of dropping the lock mid-job.
    { maxWait: 5000, timeout: 90_000 }
  );
}

export async function readHeartbeat(name: JobName): Promise<HeartbeatInput | null> {
  const row = await db.appSettings.findUnique({ where: { key: heartbeatKey(name) } });
  return parseHeartbeat(row?.value);
}

async function runUnderlying(job: JobName): Promise<Record<string, unknown>> {
  if (job === "generate") return { result: await generateClasses() };
  if (job === "remind") {
    const result = await sendReminders();
    // Failed sends are retried every 5th minute (bounded backoff, no spam).
    const retry = new Date().getUTCMinutes() % 5 === 0 ? await retryFailedMessages() : null;
    return { result, retry };
  }
  return { result: await retryFailedMessages() };
}

export type ExecuteJobOutcome =
  | { skipped: true; reason: "already_running" }
  | { skipped: false; ms: number; payload: Record<string, unknown> };

/** Shared by the worker route and the admin "run now" endpoint. */
export async function executeJob(job: JobName): Promise<ExecuteJobOutcome> {
  const r = await runJob(job, () => runUnderlying(job));
  if (r.skipped) return r;
  return { skipped: false, ms: r.ms, payload: r.value };
}
