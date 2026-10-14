/**
 * True when `err` is a Prisma unique-constraint violation (P2002).
 * Optionally restrict to violations touching one of `fields` (column names or
 * index names containing them). If Prisma gives no target, it is accepted.
 */
export function isUniqueViolation(err: unknown, fields?: readonly string[]): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  if (!fields || fields.length === 0) return true;
  const target = e.meta?.target;
  if (target === undefined || target === null) return true;
  const names = Array.isArray(target) ? target.map(String) : [String(target)];
  return names.some((n) => fields.some((f) => n.includes(f)));
}
