import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { productVariants } from "./master-data";

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

/** Status dokumen Sales Order (keputusan enum final — docs/plan.md §2.8). */
export const salesOrderStatus = pgEnum("sales_order_status", [
  "DRAFT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "PARTIALLY_SHIPPED",
  "COMPLETED",
  "CANCELLED",
]);

/**
 * Sales Order (PRD §6.4). Nomor `SO-YYYYMM-####` dari `document_sequences`,
 * dibuat dalam satu transaksi dengan barisnya.
 */
export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. SO-202610-0001. */
    number: text("number").notNull().unique(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => buyers.id),
    orderDate: date("order_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: salesOrderStatus("status").notNull().default("DRAFT"),
    notes: text("notes"),
    /** Wajib diisi saat pembatalan. */
    cancelReason: text("cancel_reason"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    /** Pembuat (NULL untuk data seed/sistem). */
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("sales_orders_buyer_idx").on(t.buyerId),
    index("sales_orders_status_idx").on(t.status),
    index("sales_orders_due_date_idx").on(t.dueDate),
    check("sales_orders_dates_chk", sql`${t.dueDate} >= ${t.orderDate}`),
  ],
);

/** Item Sales Order: satu varian per baris (UNIQUE per order). */
export const salesOrderItems = pgTable(
  "sales_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
    /** Harga satuan (IDR); 0 = belum ditetapkan. */
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
    dueDate: date("due_date"),
    notes: text("notes"),
  },
  (t) => [
    index("sales_order_items_order_idx").on(t.salesOrderId),
    index("sales_order_items_variant_idx").on(t.variantId),
    unique("sales_order_items_order_variant_uq").on(t.salesOrderId, t.variantId),
    check("sales_order_items_quantity_chk", sql`${t.quantity} > 0`),
    check("sales_order_items_price_chk", sql`${t.unitPrice} >= 0`),
  ],
);

export type SalesOrder = typeof salesOrders.$inferSelect;
export type SalesOrderItem = typeof salesOrderItems.$inferSelect;
