import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Audit log aksi penting (PRD §6). Ditulis di dalam transaksi yang sama
 * dengan mutasinya — gunakan `recordAudit(tx, ...)`.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** User pelaku; NULL untuk aksi sistem (mis. seed). */
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Aksi dalam format `entity.action`, mis. `buyer.create`, `user.roles.assign`. */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /** Detail bebas (before/after, alasan, dsb). */
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorUserId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);
