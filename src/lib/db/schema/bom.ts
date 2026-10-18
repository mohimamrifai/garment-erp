import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { materials, productVariants } from "./master-data";

/**
 * Bill of Materials (PRD §6.3): satu BOM per (varian, versi). Hanya satu versi
 * aktif per varian; BOM yang sudah digunakan SPK tidak boleh diubah — perubahan
 * dibuat sebagai versi baru (aturannya ditegakkan mulai Fase 4).
 */
export const billsOfMaterials = pgTable(
  "bills_of_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    /** Versi mulai dari 1, naik per revisi. */
    version: integer("version").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    effectiveFrom: date("effective_from").notNull().defaultNow(),
    effectiveUntil: date("effective_until"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("bills_of_materials_variant_idx").on(t.variantId),
    unique("bills_of_materials_variant_version_uq").on(t.variantId, t.version),
  ],
);

/** Item BOM: material + konsumsi per unit + cadangan (scrap allowance). */
export const bomItems = pgTable(
  "bom_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bomId: uuid("bom_id")
      .notNull()
      .references(() => billsOfMaterials.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    quantityPerUnit: numeric("quantity_per_unit", { precision: 14, scale: 4 }).notNull(),
    scrapAllowance: numeric("scrap_allowance", { precision: 14, scale: 4 }).notNull().default("0"),
    notes: text("notes"),
  },
  (t) => [
    index("bom_items_bom_idx").on(t.bomId),
    index("bom_items_material_idx").on(t.materialId),
    unique("bom_items_bom_material_uq").on(t.bomId, t.materialId),
    check("bom_items_quantity_chk", sql`${t.quantityPerUnit} > 0`),
    check("bom_items_scrap_chk", sql`${t.scrapAllowance} >= 0`),
  ],
);
