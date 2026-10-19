import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, user } from "@/lib/db/schema";
import type { ListAuditLogsQuery } from "./schemas";

/** Audit log hanya dibaca (PRD M11); tidak ada operasi ubah/hapus. */

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

export async function listAuditLogs(
  params: ListAuditLogsQuery,
): Promise<{ items: AuditLogRow[]; total: number }> {
  const conditions = [];
  const action = params.action?.trim();
  if (action) conditions.push(eq(auditLogs.action, action));

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(auditLogs.action, pattern),
        ilike(auditLogs.entityType, pattern),
        ilike(user.name, pattern),
        ilike(user.email, pattern),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.actorUserId, user.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const [totalRow] = await db
    .select({ value: count() })
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.actorUserId, user.id))
    .where(where);

  return { items: rows, total: totalRow?.value ?? 0 };
}

/** Daftar aksi unik untuk filter UI. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(asc(auditLogs.action));
  return rows.map((row) => row.action);
}
