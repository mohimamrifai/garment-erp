import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { salesOrderItems, salesOrders } from "./sales";
import { productVariants, warehouseLocations } from "./master-data";

/**
 * Pengiriman barang jadi (PRD §6.9, F5 task 5.4). Dibuat sebagai draf, lalu
 * **diposting**: stok barang jadi keluar lewat inventory engine (ISSUE) +
 * pelepasan alokasi (UNRESERVE) dalam satu transaksi DB. Dokumen POSTED
 * immutable; koreksi lewat transaksi/penyesuaian baru.
 */
export const shipmentStatus = pgEnum("shipment_status", ["DRAFT", "POSTED", "CANCELLED"]);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor surat jalan, mis. SJ-202610-0001. */
    number: text("number").notNull().unique(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id),
    /** Tanggal pengiriman (fisik). */
    shippedAt: date("shipped_at").notNull(),
    /** Lokasi barang jadi yang dikirim. */
    locationId: uuid("location_id")
      .notNull()
      .references(() => warehouseLocations.id),
    status: shipmentStatus("status").notNull().default("DRAFT"),
    notes: text("notes"),
    cancelReason: text("cancel_reason"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: text("posted_by").references(() => user.id, { onDelete: "set null" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("shipments_order_idx").on(t.salesOrderId),
    index("shipments_status_idx").on(t.status),
    index("shipments_shipped_at_idx").on(t.shippedAt),
    index("shipments_location_idx").on(t.locationId),
  ],
);

export const shipmentItems = pgTable(
  "shipment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    salesOrderItemId: uuid("sales_order_item_id")
      .notNull()
      .references(() => salesOrderItems.id),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: numeric("quantity", { precision: 16, scale: 4 }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("shipment_items_shipment_idx").on(t.shipmentId),
    index("shipment_items_order_item_idx").on(t.salesOrderItemId),
    index("shipment_items_variant_idx").on(t.variantId),
    unique("shipment_items_shipment_item_uq").on(t.shipmentId, t.salesOrderItemId),
    check("shipment_items_quantity_chk", sql`${t.quantity} > 0`),
  ],
);

export type Shipment = typeof shipments.$inferSelect;
export type ShipmentItem = typeof shipmentItems.$inferSelect;
