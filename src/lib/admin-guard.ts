// Guards for admin account changes: an admin must not lock themselves out and
// the system must never be left without an active admin.

export type AdminChangeInput = {
  actorId: string;
  target: { id: string; role: string; status: string };
  /** Omitted fields are unchanged. `delete: true` removes the account. */
  change: { role?: string; status?: string; delete?: boolean };
  activeAdminCount: number;
};

export type AdminChangeViolation = { code: "SELF_MODIFY" | "LAST_ADMIN"; message: string };

export function checkAdminChange(input: AdminChangeInput): AdminChangeViolation | null {
  const { actorId, target, change, activeAdminCount } = input;
  const roleChanges = change.role !== undefined && change.role !== target.role;
  const statusChanges = change.status !== undefined && change.status !== target.status;

  if (actorId === target.id && (change.delete || roleChanges || statusChanges)) {
    return { code: "SELF_MODIFY", message: "You cannot change, disable or delete your own account here" };
  }

  const isActiveAdmin = target.role === "ADMIN" && target.status === "ACTIVE";
  const losesAdmin =
    change.delete === true ||
    (change.role !== undefined && change.role !== "ADMIN") ||
    (change.status !== undefined && change.status !== "ACTIVE");
  if (isActiveAdmin && losesAdmin && activeAdminCount <= 1) {
    return { code: "LAST_ADMIN", message: "This is the last active admin" };
  }
  return null;
}
