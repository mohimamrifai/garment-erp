import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Penomoran dokumen (PRD: SO-/PO-/RCV-/SPK-/SJ-YYYYMM-####) dan counter umum.
 * `period` = "YYYYMM" untuk dokumen bulanan, "GLOBAL" untuk counter lintas waktu.
 * Naikkan dengan `nextDocumentNumber(tx, ...)` agar atomik dalam satu transaksi.
 */
export const documentSequences = pgTable(
  "document_sequences",
  {
    prefix: text("prefix").notNull(),
    period: text("period").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.prefix, t.period] })],
);
