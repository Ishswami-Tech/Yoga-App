import { describe, expect, test } from "bun:test";
import { checkAdminChange } from "@/lib/admin-guard";

const admin = { id: "a2", role: "ADMIN", status: "ACTIVE" };
const student = { id: "s1", role: "STUDENT", status: "ACTIVE" };

describe("checkAdminChange", () => {
  const cases: Array<[string, Parameters<typeof checkAdminChange>[0], string | null]> = [
    ["self demote", { actorId: "a2", target: admin, change: { role: "STUDENT" }, activeAdminCount: 3 }, "SELF_MODIFY"],
    ["self disable", { actorId: "a2", target: admin, change: { status: "DISABLED" }, activeAdminCount: 3 }, "SELF_MODIFY"],
    ["self delete", { actorId: "a2", target: admin, change: { delete: true }, activeAdminCount: 3 }, "SELF_MODIFY"],
    ["self rename-only (same role/status)", { actorId: "a2", target: admin, change: { role: "ADMIN", status: "ACTIVE" }, activeAdminCount: 1 }, null],
    ["demote last admin", { actorId: "a1", target: admin, change: { role: "INSTRUCTOR" }, activeAdminCount: 1 }, "LAST_ADMIN"],
    ["disable last admin", { actorId: "a1", target: admin, change: { status: "DISABLED" }, activeAdminCount: 1 }, "LAST_ADMIN"],
    ["delete last admin", { actorId: "a1", target: admin, change: { delete: true }, activeAdminCount: 1 }, "LAST_ADMIN"],
    ["demote one of two admins", { actorId: "a1", target: admin, change: { role: "STUDENT" }, activeAdminCount: 2 }, null],
    ["delete student with one admin", { actorId: "a1", target: student, change: { delete: true }, activeAdminCount: 1 }, null],
    ["disable already-disabled admin", { actorId: "a1", target: { ...admin, status: "DISABLED" }, change: { delete: true }, activeAdminCount: 1 }, null],
    ["promote student", { actorId: "a1", target: student, change: { role: "ADMIN" }, activeAdminCount: 1 }, null],
  ];
  for (const [name, input, code] of cases) {
    test(name, () => expect(checkAdminChange(input)?.code ?? null).toBe(code));
  }
});
