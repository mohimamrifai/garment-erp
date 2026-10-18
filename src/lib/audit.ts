import type { DbExecutor } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditEntry = {
  /** User pelaku; null/undefined untuk aksi sistem. */
  actorUserId?: string | null;
  /** Format `entity.action`, mis. `buyer.create`, `user.roles.assign`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
};

/**
 * Tulis audit log. WAJIB dipanggil di dalam transaksi yang sama dengan
 * mutasi datanya (`recordAudit(tx, ...)`).
 */
export async function recordAudit(tx: DbExecutor, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? null,
  });
}
