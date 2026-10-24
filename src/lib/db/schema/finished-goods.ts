import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { productVariants, warehouseLocations } from "./master-data";
import { productionOrders, qcInspections } from "./production";

/**
 * Lot barang jadi (PRD §6.9, F5 task 5.1) — jejak traceability dari QC akhir.
 *
 * Saldo barang jadi **tetap** bersumber dari inventory engine (`item_type =
 * FINISHED_GOOD`); tabel ini hanya mencatat lot (varian, lokasi, SPK, inspeksi
 * QC akhir) agar silsilah produksi dapat ditelusuri. Satu inspeksi PASS = satu
 * lot — UNIQUE `qc_inspection_id` mencegah saldo dihitung dua kali.
 */
export const finishedGoods = pgTable(
  "finished_goods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => warehouseLocations.id),
    productionOrderId: uuid("production_order_id")
      .notNull()
      .references(() => productionOrders.id),
    /** Inspeksi QC akhir (tahap packing) yang meloloskan barang ini. */
    qcInspectionId: uuid("qc_inspection_id")
      .notNull()
      .references(() => qcInspections.id),
    quantity: numeric("quantity", { precision: 16, scale: 4 }).notNull(),
    /** Harga pokok per unit dari akumulasi biaya material SPK. */
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull().default("0"),
    totalCost: numeric("total_cost", { precision: 18, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("finished_goods_variant_idx").on(t.variantId),
    index("finished_goods_location_idx").on(t.locationId),
    index("finished_goods_order_idx").on(t.productionOrderId),
    uniqueIndex("finished_goods_inspection_uq").on(t.qcInspectionId),
    check("finished_goods_quantity_chk", sql`${t.quantity} > 0`),
    check("finished_goods_cost_chk", sql`${t.unitCost} >= 0 and ${t.totalCost} >= 0`),
  ],
);

export type FinishedGoodsLot = typeof finishedGoods.$inferSelect;
