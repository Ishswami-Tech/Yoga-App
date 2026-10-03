import { db } from "@/lib/db";

export async function audit(opts: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorUserId: opts.actorUserId ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      metadata: JSON.stringify(opts.metadata ?? {}),
    },
  });
}
