import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
import { billsOfMaterials } from "./bom";
import { materials, productionLines, warehouseLocations } from "./master-data";
import { salesOrderItems } from "./sales";

/**
 * Produksi (PRD §6.7, F4 task 4.3–4.5).
 *
 * Satu SPK (`production_orders`) selalu berasal dari satu item sales order yang
 * sudah dikonfirmasi dan satu BOM aktif yang **dikunci** saat dibuat. Empat
 * tahap standar (cutting → sewing → finishing → packing) dibuat otomatis.
 * Semua catatan bersifat append-only; koreksi lewat catatan baru.
 */

export const productionOrderStatus = pgEnum("production_order_status", [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const productionStageCode = pgEnum("production_stage_code", [
  "CUTTING",
  "SEWING",
  "FINISHING",
  "PACKING",
]);

export const productionStageStatus = pgEnum("production_stage_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const qcResult = pgEnum("qc_result", ["PENDING", "PASS", "FAIL", "REWORK"]);

export const productionOrders = pgTable(
  "production_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. SPK-202610-0001. */
    number: text("number").notNull().unique(),
    salesOrderItemId: uuid("sales_order_item_id")
      .notNull()
      .references(() => salesOrderItems.id),
    /** BOM yang dipakai (dikunci saat SPK dibuat). */
    bomId: uuid("bom_id")
      .notNull()
      .references(() => billsOfMaterials.id),
    productionLineId: uuid("production_line_id").references(() => productionLines.id),
    plannedQuantity: integer("planned_quantity").notNull(),
    plannedStartDate: date("planned_start_date").notNull(),
    plannedEndDate: date("planned_end_date").notNull(),
    status: productionOrderStatus("status").notNull().default("OPEN"),
    notes: text("notes"),
    /** Alasan tetap dijalankan meskipun material kurang (gate ketersediaan). */
    shortageReason: text("shortage_reason"),
    cancelReason: text("cancel_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("production_orders_so_item_idx").on(t.salesOrderItemId),
    index("production_orders_status_idx").on(t.status),
    index("production_orders_planned_end_idx").on(t.plannedEndDate),
    check("production_orders_quantity_chk", sql`${t.plannedQuantity} > 0`),
    check("production_orders_dates_chk", sql`${t.plannedEndDate} >= ${t.plannedStartDate}`),
  ],
);

/** Tahap SPK (4 baris per SPK). Target awal = kuantitas terencana SPK. */
export const productionStages = pgTable(
  "production_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productionOrderId: uuid("production_order_id")
      .notNull()
      .references(() => productionOrders.id, { onDelete: "cascade" }),
    stageCode: productionStageCode("stage_code").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    targetQuantity: integer("target_quantity").notNull(),
    status: productionStageStatus("status").notNull().default("PENDING"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("production_stages_order_idx").on(t.productionOrderId),
    unique("production_stages_order_sequence_uq").on(t.productionOrderId, t.sequenceNumber),
    unique("production_stages_order_code_uq").on(t.productionOrderId, t.stageCode),
    check("production_stages_sequence_chk", sql`${t.sequenceNumber} >= 1`),
    check("production_stages_target_chk", sql`${t.targetQuantity} > 0`),
  ],
);

/**
 * Catatan output tahap (append-only). `passed + rejected = processed`.
 * `is_rework` = memproses ulang barang yang ditolak QC (tidak boleh
 * menggandakan output: hanya boleh sebesar sisa jatah rework inspeksi).
 */
export const productionRecords = pgTable(
  "production_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productionStageId: uuid("production_stage_id")
      .notNull()
      .references(() => productionStages.id, { onDelete: "cascade" }),
    processedQuantity: integer("processed_quantity").notNull(),
    passedQuantity: integer("passed_quantity").notNull(),
    rejectedQuantity: integer("rejected_quantity").notNull(),
    isRework: boolean("is_rework").notNull().default(false),
    notes: text("notes"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("production_records_stage_idx").on(t.productionStageId),
    check(
      "production_records_quantity_chk",
      sql`${t.processedQuantity} > 0 and ${t.passedQuantity} >= 0 and ${t.rejectedQuantity} >= 0 and ${t.passedQuantity} + ${t.rejectedQuantity} = ${t.processedQuantity}`,
    ),
  ],
);

/**
 * Pemakaian material untuk produksi (PRD FR-08 "catatan pemakaian material").
 * Dibuat langsung sebagai dokumen terposting: setiap item mengurangi stok
 * lewat inventory engine dalam satu transaksi yang sama.
 */
export const materialIssues = pgTable(
  "material_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. MIS-202610-0001. */
    number: text("number").notNull().unique(),
    productionOrderId: uuid("production_order_id")
      .notNull()
      .references(() => productionOrders.id, { onDelete: "cascade" }),
    /** Lokasi asal pengambilan material. */
    locationId: uuid("location_id")
      .notNull()
      .references(() => warehouseLocations.id),
    issuedAt: date("issued_at").notNull(),
    /** Catatan/alasan penyesuaian dari usulan BOM. */
    notes: text("notes"),
    /** Kunci anti-penggandaan dari klien (retry aman). */
    idempotencyKey: text("idempotency_key").unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("material_issues_order_idx").on(t.productionOrderId),
    index("material_issues_issued_at_idx").on(t.issuedAt),
  ],
);

export const materialIssueItems = pgTable(
  "material_issue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    materialIssueId: uuid("material_issue_id")
      .notNull()
      .references(() => materialIssues.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    quantity: numeric("quantity", { precision: 16, scale: 4 }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("material_issue_items_issue_idx").on(t.materialIssueId),
    index("material_issue_items_material_idx").on(t.materialId),
    unique("material_issue_items_issue_material_uq").on(t.materialIssueId, t.materialId),
    check("material_issue_items_quantity_chk", sql`${t.quantity} > 0`),
  ],
);

/**
 * Inspeksi QC (PRD §6.8, F4 task 4.6–4.7). Inspeksi ulang (rework) dicatat
 * sebagai baris baru dengan `parent_inspection_id` — riwayat tetap utuh dan
 * output tidak dihitung ganda.
 */
export const qcInspections = pgTable(
  "qc_inspections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. QC-202610-0001. */
    number: text("number").notNull().unique(),
    productionStageId: uuid("production_stage_id")
      .notNull()
      .references(() => productionStages.id),
    inspectedQuantity: integer("inspected_quantity").notNull(),
    passedQuantity: integer("passed_quantity").notNull(),
    rejectedQuantity: integer("rejected_quantity").notNull(),
    result: qcResult("result").notNull().default("PENDING"),
    /** Inspeksi ulang hasil rework; null untuk inspeksi pertama. */
    parentInspectionId: uuid("parent_inspection_id").references(
      (): AnyPgColumn => qcInspections.id,
    ),
    notes: text("notes"),
    inspectedBy: text("inspected_by").references(() => user.id, { onDelete: "set null" }),
    inspectedAt: timestamp("inspected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("qc_inspections_stage_idx").on(t.productionStageId),
    index("qc_inspections_result_idx").on(t.result),
    index("qc_inspections_parent_idx").on(t.parentInspectionId),
    check(
      "qc_inspections_quantity_chk",
      sql`${t.inspectedQuantity} > 0 and ${t.passedQuantity} >= 0 and ${t.rejectedQuantity} >= 0 and ${t.passedQuantity} + ${t.rejectedQuantity} <= ${t.inspectedQuantity}`,
    ),
  ],
);

/** Detail cacat per inspeksi; total kuantitas cacat ≤ kuantitas ditolak. */
export const qcDefects = pgTable(
  "qc_defects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => qcInspections.id, { onDelete: "cascade" }),
    defectCode: text("defect_code").notNull(),
    defectName: text("defect_name").notNull(),
    quantity: integer("quantity").notNull(),
    /** Tindakan: REWORK, SCRAP, RETURN, ACCEPT, dll (bebas, opsional). */
    disposition: text("disposition"),
  },
  (t) => [
    index("qc_defects_inspection_idx").on(t.inspectionId),
    check("qc_defects_quantity_chk", sql`${t.quantity} > 0`),
  ],
);

export type ProductionOrder = typeof productionOrders.$inferSelect;
export type ProductionStage = typeof productionStages.$inferSelect;
export type ProductionRecord = typeof productionRecords.$inferSelect;
export type MaterialIssue = typeof materialIssues.$inferSelect;
export type MaterialIssueItem = typeof materialIssueItems.$inferSelect;
export type QcInspection = typeof qcInspections.$inferSelect;
export type QcDefect = typeof qcDefects.$inferSelect;
