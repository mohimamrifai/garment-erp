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
import { materials, suppliers, warehouseLocations } from "./master-data";

/**
 * Purchasing & Receiving (PRD §6.5, F3 task 3.3–3.4).
 *
 * Alur: PO draf → ORDERED → penerimaan (parsial diperbolehkan) →
 * PARTIALLY_RECEIVED → RECEIVED. Stok **tidak** berubah saat PO dibuat;
 * stok bertambah saat penerimaan diposting lewat inventory engine.
 */

export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const materialReceiptStatus = pgEnum("material_receipt_status", [
  "DRAFT",
  "POSTED",
  "CANCELLED",
]);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. PO-202610-0001. */
    number: text("number").notNull().unique(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    orderDate: date("order_date").notNull(),
    /** Estimasi kedatangan (opsional). */
    expectedDate: date("expected_date"),
    status: purchaseOrderStatus("status").notNull().default("DRAFT"),
    notes: text("notes"),
    /** Wajib diisi saat pembatalan. */
    cancelReason: text("cancel_reason"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("purchase_orders_supplier_idx").on(t.supplierId),
    index("purchase_orders_status_idx").on(t.status),
    index("purchase_orders_expected_date_idx").on(t.expectedDate),
    check(
      "purchase_orders_dates_chk",
      sql`${t.expectedDate} is null or ${t.expectedDate} >= ${t.orderDate}`,
    ),
  ],
);

/** Item PO: satu material per baris (UNIQUE per order). */
export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    orderedQuantity: numeric("ordered_quantity", { precision: 16, scale: 4 }).notNull(),
    /** Harga beli satuan (IDR) untuk riwayat harga. */
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
  },
  (t) => [
    index("purchase_order_items_order_idx").on(t.purchaseOrderId),
    index("purchase_order_items_material_idx").on(t.materialId),
    unique("purchase_order_items_order_material_uq").on(t.purchaseOrderId, t.materialId),
    check("purchase_order_items_quantity_chk", sql`${t.orderedQuantity} > 0`),
    check("purchase_order_items_price_chk", sql`${t.unitPrice} >= 0`),
  ],
);

/**
 * Penerimaan material. Dibuat sebagai draf, lalu **diposting** — saat posting
 * stok masuk lewat engine dan dokumen menjadi immutable (tanpa edit/hapus;
 * koreksi dilakukan lewat transaksi penyesuaian baru).
 */
export const materialReceipts = pgTable(
  "material_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. RCV-202610-0001. */
    number: text("number").notNull().unique(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    /** Tanggal barang diterima (fisik). */
    receivedAt: date("received_at").notNull(),
    /** Lokasi tujuan penyimpanan stok. */
    locationId: uuid("location_id")
      .notNull()
      .references(() => warehouseLocations.id),
    status: materialReceiptStatus("status").notNull().default("DRAFT"),
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
    index("material_receipts_order_idx").on(t.purchaseOrderId),
    index("material_receipts_status_idx").on(t.status),
    index("material_receipts_received_at_idx").on(t.receivedAt),
    index("material_receipts_location_idx").on(t.locationId),
  ],
);

/**
 * Item penerimaan. `received_quantity` = jumlah fisik yang datang;
 * `accepted_quantity` = jumlah yang diterima baik dan masuk stok (≤ received).
 * Selisihnya diatribusikan ke catatan (mis. barang cacat dikembalikan).
 */
export const materialReceiptItems = pgTable(
  "material_receipt_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    materialReceiptId: uuid("material_receipt_id")
      .notNull()
      .references(() => materialReceipts.id, { onDelete: "cascade" }),
    purchaseOrderItemId: uuid("purchase_order_item_id")
      .notNull()
      .references(() => purchaseOrderItems.id),
    receivedQuantity: numeric("received_quantity", { precision: 16, scale: 4 }).notNull(),
    acceptedQuantity: numeric("accepted_quantity", { precision: 16, scale: 4 }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("material_receipt_items_receipt_idx").on(t.materialReceiptId),
    index("material_receipt_items_order_item_idx").on(t.purchaseOrderItemId),
    unique("material_receipt_items_receipt_item_uq").on(t.materialReceiptId, t.purchaseOrderItemId),
    check(
      "material_receipt_items_quantity_chk",
      sql`${t.receivedQuantity} > 0 and ${t.acceptedQuantity} >= 0 and ${t.acceptedQuantity} <= ${t.receivedQuantity}`,
    ),
  ],
);

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type MaterialReceipt = typeof materialReceipts.$inferSelect;
export type MaterialReceiptItem = typeof materialReceiptItems.$inferSelect;
