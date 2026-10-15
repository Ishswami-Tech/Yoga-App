export type JobName = "generate" | "remind" | "retry";
export type JobState = "ok" | "failing" | "stale" | "never_run";

export const JOB_EXPECTED_SECONDS: Record<JobName, number> = {
  generate: 300,
  remind: 60,
  retry: 300,
};

const MIN_STALE_SECONDS = 300;

export const heartbeatKey = (job: JobName): string => `jobHeartbeat:${job}`;

export function staleAfterSeconds(job: JobName): number {
  return Math.max(JOB_EXPECTED_SECONDS[job] * 3, MIN_STALE_SECONDS);
}

export interface HeartbeatInput {
  at: string;
  ok: boolean;
  error?: string;
}

export interface JobStatus {
  job: JobName;
  state: JobState;
  lastRunAt: string | null;
  ageSeconds: number | null;
  lastOk: boolean | null;
  lastError: string | null;
  staleAfterSeconds: number;
}

/** Defensive parse of a stored heartbeat; anything malformed is treated as absent. */
export function parseHeartbeat(raw: string | null | undefined): HeartbeatInput | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== "string" || Number.isNaN(Date.parse(o.at)) || typeof o.ok !== "boolean") return null;
  return {
    at: o.at,
    ok: o.ok,
    ...(typeof o.error === "string" ? { error: o.error } : {}),
  };
}

export function evaluateJobStatus(args: {
  job: JobName;
  heartbeat: HeartbeatInput | null;
  now: Date;
}): JobStatus {
  const { job, heartbeat, now } = args;
  const limit = staleAfterSeconds(job);
  const atMs = heartbeat ? Date.parse(heartbeat.at) : Number.NaN;
  if (!heartbeat || Number.isNaN(atMs)) {
    return { job, state: "never_run", lastRunAt: null, ageSeconds: null, lastOk: null, lastError: null, staleAfterSeconds: limit };
  }
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - atMs) / 1000));
  const state: JobState = ageSeconds > limit ? "stale" : heartbeat.ok ? "ok" : "failing";
  return {
    job,
    state,
    lastRunAt: heartbeat.at,
    ageSeconds,
    lastOk: heartbeat.ok,
    lastError: heartbeat.error ?? null,
    staleAfterSeconds: limit,
  };
}
