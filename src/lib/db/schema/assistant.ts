import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Kuota pemakaian Asisten AI per user.
 *
 * Satu baris per user menyimpan jendela waktu berjalan dan jumlah request.
 * Baris ini **bukan** log percakapan — isi pesan tidak pernah disimpan.
 */
export const assistantUsage = pgTable(
  "assistant_usage",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("assistant_usage_request_count_chk", sql`${t.requestCount} >= 0`)],
);
