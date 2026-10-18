import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Master data Buyer (PRD FR-04) — sekaligus pola referensi (vertical slice).
 */
export const buyers = pgTable(
  "buyers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor buyer, mis. BUY-0001 (dibuat otomatis). */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("buyers_name_idx").on(t.name)],
);
