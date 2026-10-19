import { and, asc, desc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import {
  buyers,
  inventoryBalances,
  inventoryTransactions,
  materialReceiptItems,
  materialReceipts,
  materials,
  productionLines,
  productionOrders,
  productionRecords,
  productionStages,
  productVariants,
  products,
  purchaseOrderItems,
  purchaseOrders,
  qcInspections,
  salesOrderItems,
  salesOrders,
  shipmentItems,
  shipments,
  suppliers,
  user,
  warehouseLocations,
  warehouses,
} from "@/lib/db/schema";
import { formatDateTimeId, getDateOffset, getTodayDate } from "@/lib/utils/dates";
import { INVENTORY_TRANSACTION_TYPE_LABELS } from "@/modules/inventory/status";
import { PO_STATUS_LABELS } from "@/modules/purchasing/status";
import {
  SPK_STATUS_LABELS,
  STAGE_CODE_LABELS,
} from "@/modules/production/status";
import { SO_STATUS_LABELS } from "@/modules/sales-order/status";
import { SHIPMENT_STATUS_LABELS } from "@/modules/shipping/status";
import type { RoleCode } from "@/lib/permissions";
import { computeAttainmentPercentage, computeDefectRate } from "./calc";
import { REPORT_PERIOD_DEFAULT_DAYS, type ReportSlug } from "./schemas";

/**
 * Laporan MVP (PRD FR-11, F5 task 5.6–5.7) — 7 laporan dengan filter periode
 * dan pembatasan role. Semua angka dari database; ekspor CSV memakai definisi
 * kolom yang sama agar isi layar = isi berkas.
 */

export type ReportColumnFormat = "date" | "datetime" | "number" | "percent";
export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: ReportColumnFormat;
};

export type ReportRow = Record<string, string | number | null>;

export type ReportDefinition = {
  slug: ReportSlug;
  title: string;
  description: string;
  /** Role yang boleh melihat/mengekspor laporan ini. */
  roles: readonly RoleCode[];
  columns: readonly ReportColumn[];
};

export const REPORT_DEFINITIONS: readonly ReportDefinition[] = [
  {
    slug: "sales-fulfillment",
    title: "Sales Order & Pemenuhan",
    description:
      "Pesanan pada periode berikut kuantitas dipesan, terkirim, sisa, dan persentase pemenuhan.",
    roles: ["ADMIN", "MANAGER", "SALES", "SHIPPING_STAFF"],
    columns: [
      { key: "number", label: "Nomor SO" },
      { key: "buyer", label: "Buyer" },
      { key: "orderDate", label: "Tanggal Pesan", format: "date" },
      { key: "dueDate", label: "Tenggat", format: "date" },
      { key: "status", label: "Status" },
      { key: "ordered", label: "Dipesan", align: "right", format: "number" },
      { key: "shipped", label: "Terkirim", align: "right", format: "number" },
      { key: "remaining", label: "Sisa", align: "right", format: "number" },
      { key: "fulfillment", label: "Pemenuhan (%)", align: "right", format: "percent" },
    ],
  },
  {
    slug: "purchase-receipts",
    title: "Purchase Order & Penerimaan",
    description: "PO pada periode, kuantitas dipesan, diterima baik, dan sisa yang belum datang.",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE"],
    columns: [
      { key: "number", label: "Nomor PO" },
      { key: "supplier", label: "Supplier" },
      { key: "orderDate", label: "Tanggal PO", format: "date" },
      { key: "expectedDate", label: "Perkiraan Datang", format: "date" },
      { key: "status", label: "Status" },
      { key: "ordered", label: "Dipesan", align: "right", format: "number" },
      { key: "received", label: "Diterima Baik", align: "right", format: "number" },
      { key: "remaining", label: "Sisa", align: "right", format: "number" },
    ],
  },
  {
    slug: "inventory-movements",
    title: "Stok & Mutasi Material",
    description: "Seluruh mutasi stok (material & barang jadi) pada periode, termasuk referensi dokumen.",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE", "PRODUCTION_SUPERVISOR"],
    columns: [
      { key: "number", label: "Nomor Mutasi" },
      { key: "postedAt", label: "Waktu", format: "datetime" },
      { key: "type", label: "Jenis" },
      { key: "item", label: "Item" },
      { key: "from", label: "Dari Lokasi" },
      { key: "to", label: "Ke Lokasi" },
      { key: "quantity", label: "Kuantitas", align: "right", format: "number" },
      { key: "reference", label: "Referensi" },
      { key: "notes", label: "Catatan" },
      { key: "officer", label: "Petugas" },
    ],
  },
  {
    slug: "production-output",
    title: "Output Produksi per Tahap",
    description: "Kuantitas diproses, lolos, cacat, dan rework per SPK dan tahap pada periode.",
    roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR", "QC_STAFF"],
    columns: [
      { key: "spk", label: "Nomor SPK" },
      { key: "item", label: "Item" },
      { key: "stage", label: "Tahap" },
      { key: "target", label: "Target Tahap", align: "right", format: "number" },
      { key: "processed", label: "Diproses", align: "right", format: "number" },
      { key: "passed", label: "Lolos", align: "right", format: "number" },
      { key: "rejected", label: "Cacat", align: "right", format: "number" },
      { key: "rework", label: "Rework", align: "right", format: "number" },
    ],
  },
  {
    slug: "production-attainment",
    title: "Target vs Aktual Produksi",
    description: "Pencapaian output packing dibanding target SPK yang tenggatnya jatuh pada periode.",
    roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR"],
    columns: [
      { key: "spk", label: "Nomor SPK" },
      { key: "item", label: "Item" },
      { key: "line", label: "Lini" },
      { key: "plannedEndDate", label: "Rencana Selesai", format: "date" },
      { key: "status", label: "Status" },
      { key: "target", label: "Target", align: "right", format: "number" },
      { key: "output", label: "Output Packing", align: "right", format: "number" },
      { key: "attainment", label: "Pencapaian (%)", align: "right", format: "percent" },
    ],
  },
  {
    slug: "qc-defects",
    title: "Hasil QC & Defect Rate",
    description: "Inspeksi QC pada periode: diperiksa, lolos, cacat, rework, dan defect rate per tahap.",
    roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR", "QC_STAFF"],
    columns: [
      { key: "spk", label: "Nomor SPK" },
      { key: "item", label: "Item" },
      { key: "stage", label: "Tahap" },
      { key: "inspections", label: "Inspeksi", align: "right", format: "number" },
      { key: "inspected", label: "Diperiksa", align: "right", format: "number" },
      { key: "passed", label: "Lolos", align: "right", format: "number" },
      { key: "rejected", label: "Cacat", align: "right", format: "number" },
      { key: "rework", label: "Rework", align: "right", format: "number" },
      { key: "defectRate", label: "Defect Rate (%)", align: "right", format: "percent" },
    ],
  },
  {
    slug: "fg-shipments",
    title: "Barang Jadi & Pengiriman",
    description: "Pengiriman pada periode beserta ringkasan stok barang jadi saat ini.",
    roles: ["ADMIN", "MANAGER", "SALES", "WAREHOUSE", "SHIPPING_STAFF"],
    columns: [
      { key: "number", label: "Nomor SJ" },
      { key: "shippedAt", label: "Tanggal Kirim", format: "date" },
      { key: "orderNumber", label: "Nomor SO" },
      { key: "buyer", label: "Buyer" },
      { key: "status", label: "Status" },
      { key: "location", label: "Lokasi Asal" },
      { key: "itemCount", label: "Item", align: "right", format: "number" },
      { key: "quantity", label: "Kuantitas", align: "right", format: "number" },
    ],
  },
];

export type ReportPeriod = {
  from: string;
  to: string;
  start: Date;
  endExclusive: Date;
};

export function resolveReportPeriod(params: { from?: string; to?: string }): ReportPeriod {
  const today = getTodayDate();
  const from = params.from?.trim() || getDateOffset(-(REPORT_PERIOD_DEFAULT_DAYS - 1));
  const to = params.to?.trim() || today;
  if (from > to) {
    throw ApiError.badRequest("Tanggal awal tidak boleh setelah tanggal akhir.");
  }
  const start = new Date(`${from}T00:00:00+07:00`);
  const endExclusive = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000);
  return { from, to, start, endExclusive };
}

export function canAccessReport(roles: readonly RoleCode[], definition: ReportDefinition): boolean {
  return definition.roles.some((role) => roles.includes(role));
}

export function listReportsForRoles(roles: readonly RoleCode[]): ReportDefinition[] {
  return REPORT_DEFINITIONS.filter((definition) => canAccessReport(roles, definition));
}

export function getReportDefinition(slug: string): ReportDefinition {
  const definition = REPORT_DEFINITIONS.find((item) => item.slug === slug);
  if (!definition) throw ApiError.notFound("Laporan tidak ditemukan.");
  return definition;
}

export type ReportSummaryItem = { label: string; value: string };

export type ReportResult = {
  definition: ReportDefinition;
  from: string;
  to: string;
  rows: ReportRow[];
  summary: ReportSummaryItem[];
};

/* ------------------------------------------------------------------ */
/* Helper agregasi                                                     */
/* ------------------------------------------------------------------ */

async function shippedQuantityByOrderItem(
  itemIds: string[],
): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await db
    .select({
      itemId: shipmentItems.salesOrderItemId,
      value: sql<string>`coalesce(sum(${shipmentItems.quantity}), 0)`,
    })
    .from(shipmentItems)
    .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
    .where(and(inArray(shipmentItems.salesOrderItemId, itemIds), eq(shipments.status, "POSTED")))
    .groupBy(shipmentItems.salesOrderItemId);
  return new Map(rows.map((row) => [row.itemId, Number(row.value)]));
}

async function receivedQuantityByOrderItem(
  itemIds: string[],
): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await db
    .select({
      itemId: materialReceiptItems.purchaseOrderItemId,
      value: sql<string>`coalesce(sum(${materialReceiptItems.acceptedQuantity}), 0)`,
    })
    .from(materialReceiptItems)
    .innerJoin(materialReceipts, eq(materialReceiptItems.materialReceiptId, materialReceipts.id))
    .where(
      and(
        inArray(materialReceiptItems.purchaseOrderItemId, itemIds),
        eq(materialReceipts.status, "POSTED"),
      ),
    )
    .groupBy(materialReceiptItems.purchaseOrderItemId);
  return new Map(rows.map((row) => [row.itemId, Number(row.value)]));
}

function itemLabel(row: {
  materialName?: string | null;
  materialCode?: string | null;
  productName?: string | null;
  variantSku?: string | null;
}): string {
  if (row.materialName) {
    return row.materialCode
      ? `${row.materialName} (${row.materialCode})`
      : row.materialName;
  }
  if (row.productName) {
    return row.variantSku ? `${row.productName} (${row.variantSku})` : row.productName;
  }
  return "—";
}

/* ------------------------------------------------------------------ */
/* 1. Sales order & pemenuhan                                          */
/* ------------------------------------------------------------------ */

async function salesFulfillmentRows(period: ReportPeriod): Promise<ReportRow[]> {
  const orders = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      buyer: buyers.name,
      orderDate: salesOrders.orderDate,
      dueDate: salesOrders.dueDate,
      status: salesOrders.status,
      ordered: sql<number>`coalesce(sum(${salesOrderItems.quantity}), 0)::int`,
    })
    .from(salesOrders)
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .where(
      and(
        gte(salesOrders.orderDate, period.from),
        lte(salesOrders.orderDate, period.to),
        ne(salesOrders.status, "DRAFT"),
      ),
    )
    .groupBy(salesOrders.id, buyers.id)
    .orderBy(desc(salesOrders.orderDate), asc(salesOrders.number));
  if (orders.length === 0) return [];

  const items = await db
    .select({ id: salesOrderItems.id, orderId: salesOrderItems.salesOrderId })
    .from(salesOrderItems)
    .where(
      inArray(
        salesOrderItems.salesOrderId,
        orders.map((order) => order.id),
      ),
    );
  const shippedMap = await shippedQuantityByOrderItem(items.map((item) => item.id));
  const shippedByOrder = new Map<string, number>();
  for (const item of items) {
    shippedByOrder.set(
      item.orderId,
      (shippedByOrder.get(item.orderId) ?? 0) + (shippedMap.get(item.id) ?? 0),
    );
  }

  return orders.map((order) => {
    const shipped = shippedByOrder.get(order.id) ?? 0;
    const remaining = Math.max(0, order.ordered - shipped);
    return {
      number: order.number,
      buyer: order.buyer,
      orderDate: order.orderDate,
      dueDate: order.dueDate,
      status: SO_STATUS_LABELS[order.status],
      ordered: order.ordered,
      shipped,
      remaining,
      fulfillment: computeAttainmentPercentage(order.ordered, shipped),
    };
  });
}

/* ------------------------------------------------------------------ */
/* 2. Purchase order & penerimaan                                      */
/* ------------------------------------------------------------------ */

async function purchaseReceiptRows(period: ReportPeriod): Promise<ReportRow[]> {
  const orders = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      supplier: suppliers.name,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
      ordered: sql<string>`coalesce(sum(${purchaseOrderItems.orderedQuantity}), 0)`,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .where(
      and(
        gte(purchaseOrders.orderDate, period.from),
        lte(purchaseOrders.orderDate, period.to),
        ne(purchaseOrders.status, "DRAFT"),
      ),
    )
    .groupBy(purchaseOrders.id, suppliers.id)
    .orderBy(desc(purchaseOrders.orderDate), asc(purchaseOrders.number));
  if (orders.length === 0) return [];

  const items = await db
    .select({ id: purchaseOrderItems.id, orderId: purchaseOrderItems.purchaseOrderId })
    .from(purchaseOrderItems)
    .where(
      inArray(
        purchaseOrderItems.purchaseOrderId,
        orders.map((order) => order.id),
      ),
    );
  const receivedMap = await receivedQuantityByOrderItem(items.map((item) => item.id));
  const receivedByOrder = new Map<string, number>();
  for (const item of items) {
    receivedByOrder.set(
      item.orderId,
      (receivedByOrder.get(item.orderId) ?? 0) + (receivedMap.get(item.id) ?? 0),
    );
  }

  return orders.map((order) => {
    const ordered = Number(order.ordered);
    const received = receivedByOrder.get(order.id) ?? 0;
    return {
      number: order.number,
      supplier: order.supplier,
      orderDate: order.orderDate,
      expectedDate: order.expectedDate,
      status: PO_STATUS_LABELS[order.status],
      ordered,
      received,
      remaining: Math.max(0, ordered - received),
    };
  });
}

/* ------------------------------------------------------------------ */
/* 3. Stok & mutasi                                                    */
/* ------------------------------------------------------------------ */

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  "material-receipt": "Penerimaan material",
  "material-issue": "Pemakaian material",
  shipment: "Pengiriman",
  "qc-inspection": "Inspeksi QC",
  "so-allocation": "Alokasi sales order",
  "manual-transfer": "Transfer manual",
  "manual-adjustment": "Penyesuaian manual",
};

async function inventoryMovementRows(period: ReportPeriod): Promise<ReportRow[]> {
  const fromLocation = alias(warehouseLocations, "from_location");
  const toLocation = alias(warehouseLocations, "to_location");
  const fromWarehouse = alias(warehouses, "from_warehouse");
  const toWarehouse = alias(warehouses, "to_warehouse");

  const rows = await db
    .select({
      number: inventoryTransactions.number,
      postedAt: inventoryTransactions.postedAt,
      type: inventoryTransactions.transactionType,
      materialName: materials.name,
      materialCode: materials.code,
      productName: products.name,
      variantSku: productVariants.variantSku,
      fromLocationCode: fromLocation.code,
      fromWarehouseName: fromWarehouse.name,
      toLocationCode: toLocation.code,
      toWarehouseName: toWarehouse.name,
      quantity: inventoryTransactions.quantity,
      referenceType: inventoryTransactions.referenceType,
      referenceId: inventoryTransactions.referenceId,
      notes: inventoryTransactions.notes,
      officer: user.name,
    })
    .from(inventoryTransactions)
    .leftJoin(materials, eq(inventoryTransactions.materialId, materials.id))
    .leftJoin(productVariants, eq(inventoryTransactions.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(fromLocation, eq(inventoryTransactions.fromLocationId, fromLocation.id))
    .leftJoin(fromWarehouse, eq(fromLocation.warehouseId, fromWarehouse.id))
    .leftJoin(toLocation, eq(inventoryTransactions.toLocationId, toLocation.id))
    .leftJoin(toWarehouse, eq(toLocation.warehouseId, toWarehouse.id))
    .leftJoin(user, eq(inventoryTransactions.postedBy, user.id))
    .where(
      and(
        gte(inventoryTransactions.postedAt, period.start),
        lt(inventoryTransactions.postedAt, period.endExclusive),
      ),
    )
    .orderBy(desc(inventoryTransactions.postedAt), desc(inventoryTransactions.number))
    .limit(5000);

  return rows.map((row) => ({
    number: row.number,
    postedAt: formatDateTimeId(row.postedAt),
    type: INVENTORY_TRANSACTION_TYPE_LABELS[row.type],
    item: itemLabel(row),
    from: row.fromLocationCode
      ? `${row.fromWarehouseName} / ${row.fromLocationCode}`
      : null,
    to: row.toLocationCode ? `${row.toWarehouseName} / ${row.toLocationCode}` : null,
    quantity: Number(row.quantity),
    reference: row.referenceType
      ? (REFERENCE_TYPE_LABELS[row.referenceType] ?? row.referenceType)
      : null,
    notes: row.notes,
    officer: row.officer,
  }));
}

/* ------------------------------------------------------------------ */
/* 4. Output produksi per tahap                                        */
/* ------------------------------------------------------------------ */

async function productionOutputRows(period: ReportPeriod): Promise<ReportRow[]> {
  const rows = await db
    .select({
      spk: productionOrders.number,
      productName: products.name,
      variantSku: productVariants.variantSku,
      stageCode: productionStages.stageCode,
      sequenceNumber: productionStages.sequenceNumber,
      target: productionStages.targetQuantity,
      processed: sql<number>`coalesce(sum(${productionRecords.processedQuantity}), 0)::int`,
      passed: sql<number>`coalesce(sum(${productionRecords.passedQuantity}), 0)::int`,
      rejected: sql<number>`coalesce(sum(${productionRecords.rejectedQuantity}), 0)::int`,
      rework: sql<number>`coalesce(sum(case when ${productionRecords.isRework} then ${productionRecords.processedQuantity} else 0 end), 0)::int`,
    })
    .from(productionRecords)
    .innerJoin(productionStages, eq(productionRecords.productionStageId, productionStages.id))
    .innerJoin(productionOrders, eq(productionStages.productionOrderId, productionOrders.id))
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        gte(productionRecords.recordedAt, period.start),
        lt(productionRecords.recordedAt, period.endExclusive),
      ),
    )
    .groupBy(productionOrders.id, productionStages.id, productVariants.id, products.id)
    .orderBy(asc(productionOrders.number), asc(productionStages.sequenceNumber));

  return rows.map((row) => ({
    spk: row.spk,
    item: itemLabel(row),
    stage: STAGE_CODE_LABELS[row.stageCode],
    target: row.target,
    processed: row.processed,
    passed: row.passed,
    rejected: row.rejected,
    rework: row.rework,
  }));
}

/* ------------------------------------------------------------------ */
/* 5. Target vs aktual                                                 */
/* ------------------------------------------------------------------ */

async function productionAttainmentRows(period: ReportPeriod): Promise<ReportRow[]> {
  const rows = await db
    .select({
      spk: productionOrders.number,
      productName: products.name,
      variantSku: productVariants.variantSku,
      line: productionLines.name,
      plannedEndDate: productionOrders.plannedEndDate,
      status: productionOrders.status,
      target: productionOrders.plannedQuantity,
      output: sql<number>`coalesce((
        select sum(pr.passed_quantity)
        from production_records pr
        join production_stages ps on ps.id = pr.production_stage_id
        where ps.production_order_id = ${productionOrders.id} and ps.stage_code = 'PACKING'
      ), 0)::int`,
    })
    .from(productionOrders)
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(productionLines, eq(productionOrders.productionLineId, productionLines.id))
    .where(
      and(
        gte(productionOrders.plannedEndDate, period.from),
        lte(productionOrders.plannedEndDate, period.to),
        ne(productionOrders.status, "CANCELLED"),
      ),
    )
    .orderBy(asc(productionOrders.plannedEndDate), asc(productionOrders.number));

  return rows.map((row) => ({
    spk: row.spk,
    item: itemLabel(row),
    line: row.line,
    plannedEndDate: row.plannedEndDate,
    status: SPK_STATUS_LABELS[row.status],
    target: row.target,
    output: row.output,
    attainment: computeAttainmentPercentage(row.target, row.output),
  }));
}

/* ------------------------------------------------------------------ */
/* 6. QC & defect rate                                                 */
/* ------------------------------------------------------------------ */

async function qcDefectRows(period: ReportPeriod): Promise<ReportRow[]> {
  const rows = await db
    .select({
      spk: productionOrders.number,
      productName: products.name,
      variantSku: productVariants.variantSku,
      stageCode: productionStages.stageCode,
      sequenceNumber: productionStages.sequenceNumber,
      inspections: sql<number>`count(*)::int`,
      inspected: sql<number>`coalesce(sum(${qcInspections.inspectedQuantity}), 0)::int`,
      passed: sql<number>`coalesce(sum(${qcInspections.passedQuantity}), 0)::int`,
      rejected: sql<number>`coalesce(sum(${qcInspections.rejectedQuantity}), 0)::int`,
      rework: sql<number>`count(*) filter (where ${qcInspections.result} = 'REWORK')::int`,
    })
    .from(qcInspections)
    .innerJoin(productionStages, eq(qcInspections.productionStageId, productionStages.id))
    .innerJoin(productionOrders, eq(productionStages.productionOrderId, productionOrders.id))
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        gte(qcInspections.inspectedAt, period.start),
        lt(qcInspections.inspectedAt, period.endExclusive),
      ),
    )
    .groupBy(productionOrders.id, productionStages.id, productVariants.id, products.id)
    .orderBy(asc(productionOrders.number), asc(productionStages.sequenceNumber));

  return rows.map((row) => ({
    spk: row.spk,
    item: itemLabel(row),
    stage: STAGE_CODE_LABELS[row.stageCode],
    inspections: row.inspections,
    inspected: row.inspected,
    passed: row.passed,
    rejected: row.rejected,
    rework: row.rework,
    defectRate: computeDefectRate(row.inspected, row.rejected),
  }));
}

/* ------------------------------------------------------------------ */
/* 7. Barang jadi & pengiriman                                         */
/* ------------------------------------------------------------------ */

async function finishedGoodsShipmentRows(
  period: ReportPeriod,
): Promise<{ rows: ReportRow[]; summary: ReportSummaryItem[] }> {
  const rows = await db
    .select({
      number: shipments.number,
      shippedAt: shipments.shippedAt,
      orderNumber: salesOrders.number,
      buyer: buyers.name,
      status: shipments.status,
      locationCode: warehouseLocations.code,
      warehouseName: warehouses.name,
      itemCount: sql<number>`count(${shipmentItems.id})::int`,
      quantity: sql<string>`coalesce(sum(${shipmentItems.quantity}), 0)`,
    })
    .from(shipments)
    .innerJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .innerJoin(warehouseLocations, eq(shipments.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .leftJoin(shipmentItems, eq(shipmentItems.shipmentId, shipments.id))
    .where(and(gte(shipments.shippedAt, period.from), lte(shipments.shippedAt, period.to)))
    .groupBy(shipments.id, salesOrders.id, buyers.id, warehouseLocations.id, warehouses.id)
    .orderBy(desc(shipments.shippedAt), desc(shipments.number));

  const [stock] = await db
    .select({
      onHand: sql<string>`coalesce(sum(${inventoryBalances.quantityOnHand}), 0)`,
      reserved: sql<string>`coalesce(sum(${inventoryBalances.quantityReserved}), 0)`,
    })
    .from(inventoryBalances)
    .where(eq(inventoryBalances.itemType, "FINISHED_GOOD"));

  const shippedRows = rows.map((row) => ({
    number: row.number,
    shippedAt: row.shippedAt,
    orderNumber: row.orderNumber,
    buyer: row.buyer,
    status: SHIPMENT_STATUS_LABELS[row.status],
    location: `${row.warehouseName} / ${row.locationCode}`,
    itemCount: row.itemCount,
    quantity: Number(row.quantity),
  }));

  const postedRows = rows.filter((row) => row.status === "POSTED");
  const totalPosted = postedRows.reduce((sum, row) => sum + Number(row.quantity), 0);

  return {
    rows: shippedRows,
    summary: [
      {
        label: "Stok barang jadi saat ini",
        value: `${Number(stock?.onHand ?? 0).toLocaleString("id-ID")} pcs`,
      },
      {
        label: "Tersedia (tidak dialokasikan)",
        value: `${Number(
          Number(stock?.onHand ?? 0) - Number(stock?.reserved ?? 0),
        ).toLocaleString("id-ID")} pcs`,
      },
      {
        label: "Pengiriman diposting pada periode",
        value: `${postedRows.length} dokumen / ${totalPosted.toLocaleString("id-ID")} pcs`,
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export async function buildReport(
  slug: ReportSlug,
  params: { from?: string; to?: string },
): Promise<ReportResult> {
  const definition = getReportDefinition(slug);
  const period = resolveReportPeriod(params);

  let rows: ReportRow[] = [];
  let summary: ReportSummaryItem[] = [];

  switch (slug) {
    case "sales-fulfillment":
      rows = await salesFulfillmentRows(period);
      break;
    case "purchase-receipts":
      rows = await purchaseReceiptRows(period);
      break;
    case "inventory-movements":
      rows = await inventoryMovementRows(period);
      break;
    case "production-output":
      rows = await productionOutputRows(period);
      break;
    case "production-attainment":
      rows = await productionAttainmentRows(period);
      break;
    case "qc-defects": {
      rows = await qcDefectRows(period);
      const inspected = rows.reduce((sum, row) => sum + Number(row.inspected ?? 0), 0);
      const rejected = rows.reduce((sum, row) => sum + Number(row.rejected ?? 0), 0);
      summary = [
        {
          label: "Total diperiksa",
          value: `${inspected.toLocaleString("id-ID")} unit`,
        },
        {
          label: "Total cacat",
          value: `${rejected.toLocaleString("id-ID")} unit`,
        },
        {
          label: "Defect rate periode",
          value: `${computeDefectRate(inspected, rejected)}%`,
        },
      ];
      break;
    }
    case "fg-shipments": {
      const result = await finishedGoodsShipmentRows(period);
      rows = result.rows;
      summary = result.summary;
      break;
    }
  }

  return {
    definition,
    from: period.from,
    to: period.to,
    rows,
    summary,
  };
}
