import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { materials, productVariants, warehouseLocations } from "./master-data";

/**
 * Inventory engine (PRD §6.6, F3 task 3.1) — satu-satunya jalur perubahan stok.
 *
 * - `inventory_transactions` = buku besar mutasi yang **immutable** (tidak
 *   pernah diubah/dihapus setelah dibuat; koreksi = transaksi baru).
 * - `inventory_balances` = saldo berjalan per (item, lokasi), diperbarui di
 *   dalam transaksi DB yang sama oleh `postMovement()`.
 *
 * `item_type` membedakan bahan baku (material) dan barang jadi (varian
 * produk, dipakai mulai Fase 5). CHECK di level DB memastikan tepat satu FK
 * item terisi dan arah mutasi konsisten dengan tipe transaksinya.
 */

export const inventoryItemType = pgEnum("inventory_item_type", ["MATERIAL", "FINISHED_GOOD"]);

export const inventoryTransactionType = pgEnum("inventory_transaction_type", [
  "RECEIPT",
  "ISSUE",
  "TRANSFER",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RESERVE",
  "UNRESERVE",
]);

/** Saldo berjalan per (item, lokasi). UNIQUE parsial: satu baris per item+lokasi. */
export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemType: inventoryItemType("item_type").notNull(),
    materialId: uuid("material_id").references(() => materials.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => warehouseLocations.id),
    quantityOnHand: numeric("quantity_on_hand", { precision: 16, scale: 4 }).notNull().default("0"),
    quantityReserved: numeric("quantity_reserved", { precision: 16, scale: 4 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("inventory_balances_material_idx").on(t.materialId),
    index("inventory_balances_variant_idx").on(t.variantId),
    index("inventory_balances_location_idx").on(t.locationId),
    uniqueIndex("inventory_balances_material_location_uq")
      .on(t.materialId, t.locationId)
      .where(sql`${t.materialId} is not null`),
    uniqueIndex("inventory_balances_variant_location_uq")
      .on(t.variantId, t.locationId)
      .where(sql`${t.variantId} is not null`),
    check("inventory_balances_item_chk", sql`num_nonnulls(${t.materialId}, ${t.variantId}) = 1`),
    check(
      "inventory_balances_item_type_chk",
      sql`(${t.itemType} = 'MATERIAL') = (${t.materialId} is not null)`,
    ),
    check("inventory_balances_on_hand_chk", sql`${t.quantityOnHand} >= 0`),
    check("inventory_balances_reserved_chk", sql`${t.quantityReserved} >= 0`),
    check("inventory_balances_reserved_le_on_hand_chk", sql`${t.quantityReserved} <= ${t.quantityOnHand}`),
  ],
);

/** Buku besar mutasi stok — immutable, selalu merujuk dokumen sumber. */
export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor mutasi, mis. TRX-202610-0001. */
    number: text("number").notNull().unique(),
    itemType: inventoryItemType("item_type").notNull(),
    materialId: uuid("material_id").references(() => materials.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    transactionType: inventoryTransactionType("transaction_type").notNull(),
    /** Selalu positif; arah ditentukan `transaction_type`. */
    quantity: numeric("quantity", { precision: 16, scale: 4 }).notNull(),
    fromLocationId: uuid("from_location_id").references(() => warehouseLocations.id),
    toLocationId: uuid("to_location_id").references(() => warehouseLocations.id),
    /** Dokumen sumber, mis. `material-receipt` / `manual-adjustment`. */
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    notes: text("notes"),
    /** Kunci anti penggandaan untuk endpoint posting (UNIQUE). */
    idempotencyKey: text("idempotency_key").unique(),
    postedBy: text("posted_by").references(() => user.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_transactions_material_idx").on(t.materialId),
    index("inventory_transactions_variant_idx").on(t.variantId),
    index("inventory_transactions_type_idx").on(t.transactionType),
    index("inventory_transactions_posted_at_idx").on(t.postedAt),
    index("inventory_transactions_reference_idx").on(t.referenceType, t.referenceId),
    check("inventory_transactions_item_chk", sql`num_nonnulls(${t.materialId}, ${t.variantId}) = 1`),
    check(
      "inventory_transactions_item_type_chk",
      sql`(${t.itemType} = 'MATERIAL') = (${t.materialId} is not null)`,
    ),
    check("inventory_transactions_quantity_chk", sql`${t.quantity} > 0`),
    check(
      "inventory_transactions_shape_chk",
      sql`(case ${t.transactionType}
        when 'RECEIPT' then ${t.toLocationId} is not null and ${t.fromLocationId} is null
        when 'ISSUE' then ${t.fromLocationId} is not null and ${t.toLocationId} is null
        when 'TRANSFER' then ${t.fromLocationId} is not null and ${t.toLocationId} is not null and ${t.fromLocationId} <> ${t.toLocationId}
        when 'ADJUSTMENT_IN' then ${t.toLocationId} is not null and ${t.fromLocationId} is null
        when 'ADJUSTMENT_OUT' then ${t.fromLocationId} is not null and ${t.toLocationId} is null
        when 'RESERVE' then ${t.fromLocationId} is not null and ${t.toLocationId} is null
        when 'UNRESERVE' then ${t.fromLocationId} is not null and ${t.toLocationId} is null
      end)`,
    ),
  ],
);

export type InventoryBalance = typeof inventoryBalances.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
