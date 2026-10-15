// Run with: RUN_DB_TESTS=1 DATABASE_URL=postgresql://... bun test tests/db
import { afterAll, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { db } from "../../src/lib/db";
import {
  createSession,
  destroySession,
  getUserIdForToken,
  hashSessionToken,
  revokeAllSessions,
} from "../../src/lib/auth";
import { POST as logout } from "../../src/app/api/auth/logout/route";

const suite = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const userIds: string[] = [];

async function user(tag: string) {
  const u = await db.user.create({
    data: { email: `${tag}-${Date.now()}${Math.floor(Math.random() * 1e6)}@sessions.test`, name: tag },
  });
  userIds.push(u.id);
  return u;
}

function logoutReq(token: string, body?: unknown) {
  return new NextRequest("http://localhost/api/auth/logout", {
    method: "POST",
    headers: { cookie: `yoga_session=${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

suite("sessions (Postgres)", () => {
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test("stores only the hash and resolves by the raw token", async () => {
    const u = await user("hash");
    const token = await createSession(u.id);
    expect(await db.session.findUnique({ where: { token } })).toBeNull();
    expect((await db.session.findUnique({ where: { token: hashSessionToken(token) } }))?.userId).toBe(u.id);
    expect(await getUserIdForToken(token)).toBe(u.id);
    await destroySession(token);
    expect(await getUserIdForToken(token)).toBeNull();
  });

  test("expired sessions are rejected", async () => {
    const u = await user("exp");
    const token = await createSession(u.id);
    await db.session.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getUserIdForToken(token)).toBeNull();
  });

  test("revokeAllSessions deletes only that user's sessions and returns count", async () => {
    const a = await user("a");
    const b = await user("b");
    await createSession(a.id);
    await createSession(a.id);
    const tb = await createSession(b.id);
    expect(await revokeAllSessions(a.id)).toBe(2);
    expect(await revokeAllSessions(a.id)).toBe(0);
    expect(await getUserIdForToken(tb)).toBe(b.id);
  });

  test("logout without body removes only the presented session", async () => {
    const u = await user("l1");
    const t1 = await createSession(u.id);
    const t2 = await createSession(u.id);
    const res = await logout(logoutReq(t1));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("yoga_session=;");
    expect(await getUserIdForToken(t1)).toBeNull();
    expect(await getUserIdForToken(t2)).toBe(u.id);
  });

  test("logout {all:true} revokes every session of the user", async () => {
    const u = await user("l2");
    const other = await user("l3");
    const t1 = await createSession(u.id);
    const t2 = await createSession(u.id);
    const to = await createSession(other.id);
    const res = await logout(logoutReq(t1, { all: true }));
    expect(((await res.json()) as { revoked: number }).revoked).toBe(2);
    expect(await getUserIdForToken(t1)).toBeNull();
    expect(await getUserIdForToken(t2)).toBeNull();
    expect(await getUserIdForToken(to)).toBe(other.id);
  });

  test("logout with an unknown token is still ok", async () => {
    const res = await logout(logoutReq("nope", { all: true }));
    expect(res.status).toBe(200);
  });
});
