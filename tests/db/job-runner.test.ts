// Run with: RUN_DB_TESTS=1 DATABASE_URL=postgresql://... bun test tests/db
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "../../src/lib/db";
import { runJob, readHeartbeat } from "../../src/lib/services/job-runner";
import { heartbeatKey } from "../../src/lib/services/job-status";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

suite("runJob (Postgres)", () => {
  const clean = () => db.appSettings.deleteMany({ where: { key: { startsWith: "jobHeartbeat:" } } });
  beforeAll(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  test("concurrent calls run fn once; the other is skipped", async () => {
    await clean();
    let runs = 0;
    const fn = async () => {
      runs++;
      await sleep(600);
      return "done";
    };
    const [a, b] = await Promise.all([runJob("generate", fn), runJob("generate", fn)]);
    expect(runs).toBe(1);
    expect([a.skipped, b.skipped].sort()).toEqual([false, true]);
    const skipped = [a, b].find((r) => r.skipped);
    expect(skipped).toEqual({ skipped: true, reason: "already_running" });
  });

  test("different jobs do not block each other", async () => {
    const fn = async () => {
      await sleep(300);
      return 1;
    };
    const [a, b] = await Promise.all([runJob("generate", fn), runJob("remind", fn)]);
    expect(a.skipped).toBe(false);
    expect(b.skipped).toBe(false);
  });

  test("heartbeat written on success", async () => {
    await clean();
    const r = await runJob("remind", async () => ({ sent: 3 }));
    expect(r.skipped).toBe(false);
    const hb = await readHeartbeat("remind");
    expect(hb?.ok).toBe(true);
    const row = await db.appSettings.findUnique({ where: { key: heartbeatKey("remind") } });
    const parsed = JSON.parse(row!.value);
    expect(typeof parsed.ms).toBe("number");
    expect(parsed.summary).toContain("sent");
  });

  test("heartbeat written on failure with truncated error, and error rethrown", async () => {
    await clean();
    const long = "x".repeat(1000);
    await expect(
      runJob("generate", async () => {
        throw new Error(`bad Bearer abc123 ${long}`);
      })
    ).rejects.toThrow();
    const hb = await readHeartbeat("generate");
    expect(hb?.ok).toBe(false);
    expect(hb!.error!.length).toBeLessThanOrEqual(300);
    expect(hb!.error).not.toContain("abc123");
  });

  test("skipped run does not overwrite the heartbeat", async () => {
    await clean();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = runJob("generate", async () => {
      await gate;
      return "first";
    });
    await sleep(300);
    const second = await runJob("generate", async () => "second");
    expect(second.skipped).toBe(true);
    expect(await readHeartbeat("generate")).toBeNull();
    release();
    await first;
    const hb = await readHeartbeat("generate");
    expect(hb?.ok).toBe(true);
  });
});
