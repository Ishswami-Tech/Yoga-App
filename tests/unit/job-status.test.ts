import { describe, expect, test } from "bun:test";
import {
  JOB_EXPECTED_SECONDS,
  evaluateJobStatus,
  parseHeartbeat,
  staleAfterSeconds,
} from "../../src/lib/services/job-status";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const ago = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

describe("staleAfterSeconds", () => {
  test("expected cadences", () => {
    expect(JOB_EXPECTED_SECONDS).toEqual({ generate: 300, remind: 60, retry: 300 });
  });
  test.each([
    ["generate", 900],
    ["remind", 300],
    ["retry", 900],
  ] as const)("%s -> %d", (job, want) => expect(staleAfterSeconds(job)).toBe(want));
});

describe("evaluateJobStatus", () => {
  const cases: Array<[string, "generate" | "remind", { age: number; ok: boolean } | null, string]> = [
    ["no heartbeat", "generate", null, "never_run"],
    ["fresh ok", "generate", { age: 10, ok: true }, "ok"],
    ["ok at exact boundary", "generate", { age: 900, ok: true }, "ok"],
    ["stale just past boundary", "generate", { age: 901, ok: true }, "stale"],
    ["remind ok at 300", "remind", { age: 300, ok: true }, "ok"],
    ["remind stale at 301", "remind", { age: 301, ok: true }, "stale"],
    ["failing fresh", "remind", { age: 30, ok: false }, "failing"],
    ["failing at boundary", "remind", { age: 300, ok: false }, "failing"],
    ["failing but stale => stale", "remind", { age: 301, ok: false }, "stale"],
  ];
  test.each(cases)("%s", (_n, job, hb, state) => {
    const r = evaluateJobStatus({
      job,
      heartbeat: hb ? { at: ago(hb.age), ok: hb.ok, error: hb.ok ? undefined : "boom" } : null,
      now: NOW,
    });
    expect(r.state).toBe(state);
    expect(r.job).toBe(job);
    expect(r.staleAfterSeconds).toBe(staleAfterSeconds(job));
  });

  test("never_run shape", () => {
    expect(evaluateJobStatus({ job: "remind", heartbeat: null, now: NOW })).toEqual({
      job: "remind",
      state: "never_run",
      lastRunAt: null,
      ageSeconds: null,
      lastOk: null,
      lastError: null,
      staleAfterSeconds: 300,
    });
  });

  test("populated shape", () => {
    const r = evaluateJobStatus({ job: "generate", heartbeat: { at: ago(42), ok: false, error: "x" }, now: NOW });
    expect(r).toMatchObject({ lastRunAt: ago(42), ageSeconds: 42, lastOk: false, lastError: "x" });
  });

  test("future timestamp clamps age to 0", () => {
    const r = evaluateJobStatus({ job: "generate", heartbeat: { at: ago(-50), ok: true }, now: NOW });
    expect(r.ageSeconds).toBe(0);
    expect(r.state).toBe("ok");
  });

  test("unparseable date treated as never_run", () => {
    expect(evaluateJobStatus({ job: "generate", heartbeat: { at: "nope", ok: true }, now: NOW }).state).toBe("never_run");
  });
});

describe("parseHeartbeat", () => {
  test.each([
    ["null", null],
    ["empty", ""],
    ["bad json", "{not json"],
    ["array", "[]"],
    ["missing at", '{"ok":true}'],
    ["bad ok type", '{"at":"2026-01-01T00:00:00Z","ok":"yes"}'],
    ["bad at", '{"at":"zzz","ok":true}'],
  ])("%s => null", (_n, raw) => expect(parseHeartbeat(raw as string | null)).toBeNull());

  test("valid", () => {
    expect(parseHeartbeat('{"at":"2026-01-01T00:00:00.000Z","ok":false,"ms":5,"error":"e","extra":1}')).toEqual({
      at: "2026-01-01T00:00:00.000Z",
      ok: false,
      error: "e",
    });
  });
});
