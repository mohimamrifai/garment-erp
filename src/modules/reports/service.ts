import { and, asc, desc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import {
  accounts,
  buyers,
  inventoryBalances,
  inventoryTransactions,
  journalEntries,
  journalLines,
  materialReceiptItems,
  materialReceipts,
  materials,
  productionLines,
  productionOrders,
  productionRecords,
  productionStages,
  productVariants,
  products,
  payrollRuns,
  purchaseBills,
  purchaseOrderItems,
  purchaseOrders,
  qcInspections,
  salesInvoices,
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
import { formatIdr } from "@/lib/utils/currency";
import { INVENTORY_TRANSACTION_TYPE_LABELS } from "@/modules/inventory/status";
import { PO_STATUS_LABELS } from "@/modules/purchasing/status";
import {
  SPK_STATUS_LABELS,
  STAGE_CODE_LABELS,
} from "@/modules/production/status";
import { SO_STATUS_LABELS } from "@/modules/sales-order/status";
import { SHIPMENT_STATUS_LABELS } from "@/modules/shipping/status";
import { ACCOUNT_TYPE_LABELS, CASH_FLOW_LABELS } from "@/modules/accounting/schemas";
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
  {
    slug: "trial-balance",
    title: "Neraca Saldo",
    description: "Saldo debit dan kredit seluruh akun pada periode berjalan.",
    roles: ["ADMIN", "MANAGER", "FINANCE_STAFF"],
    columns: [
      { key: "code", label: "Kode" },
      { key: "account", label: "Akun" },
      { key: "type", label: "Tipe" },
      { key: "debit", label: "Debit", align: "right", format: "number" },
      { key: "credit", label: "Kredit", align: "right", format: "number" },
      { key: "balance", label: "Saldo", align: "right", format: "number" },
    ],
  },
  {
    slug: "income-statement",
    title: "Laba Rugi",
    description: "Pendapatan dan beban pada periode, beserta laba bersih.",
    roles: ["ADMIN", "MANAGER", "FINANCE_STAFF"],
    columns: [
      { key: "section", label: "Kelompok" },
      { key: "code", label: "Kode" },
      { key: "account", label: "Akun" },
      { key: "amount", label: "Jumlah", align: "right", format: "number" },
    ],
  },
  {
    slug: "balance-sheet",
    title: "Neraca",
    description: "Posisi aset, kewajiban, dan ekuitas per tanggal akhir periode.",
    roles: ["ADMIN", "MANAGER", "FINANCE_STAFF"],
    columns: [
      { key: "section", label: "Kelompok" },
      { key: "code", label: "Kode" },
      { key: "account", label: "Akun" },
      { key: "amount", label: "Jumlah", align: "right", format: "number" },
    ],
  },
  {
    slug: "general-ledger",
    title: "Buku Besar",
    description: "Rincian baris jurnal per akun pada periode.",
    roles: ["ADMIN", "MANAGER", "FINANCE_STAFF"],
    columns: [
      { key: "date", label: "Tanggal", format: "date" },
      { key: "journal", label: "Nomor Jurnal" },
      { key: "account", label: "Akun" },
      { key: "description", label: "Keterangan" },
      { key: "debit", label: "Debit", align: "right", format: "number" },
      { key: "credit", label: "Kredit", align: "right", format: "number" },
    ],
  },
  {
    slug: "cash-flow",
    title: "Arus Kas",
    description: "Mutasi kas dan bank pada periode berdasarkan kategori arus kas.",
    roles: ["ADMIN", "MANAGER", "FINANCE_STAFF"],
    columns: [
      { key: "date", label: "Tanggal", format: "date" },
      { key: "journal", label: "Nomor Jurnal" },
      { key: "description", label: "Keterangan" },
      { key: "category", label: "Kategori" },
      { key: "inflow", label: "Kas Masuk", align: "right", format: "number" },
      { key: "outflow", label: "Kas Keluar", align: "right", format: "number" },
      { key: "net", label: "Neto", align: "right", format: "number" },
    ],
  },
  {
    slug: "ar-aging",
    title: "Umur Piutang",
    description: "Faktur penjualan yang belum lunas beserta umur jatuh tempo.",
    roles: ["ADMIN", "MANAGER", "FINANCE_STAFF"],
    columns: [
      { key: "invoice", label: "Faktur" },
      { key: "buyer", label: "Buyer" },
      { key: "invoiceDate", label: "Tanggal", format: "date" },
      { key: "dueDate", label: "Jatuh Tempo", format: "date" },
      { key: "total", label: "Total", align: "right", format: "number" },
      { key: "paid", label: "Dibayar", align: "right", format: "number" },
      { key: "outstanding", label: "Sisa", align: "right", format: "number" },
      { key: "ageDays", label: "Umur (hari)", align: "right", format: "number" },
      { key: "bucket", label: "Kategori" },
    ],
  },
  {
    slug: "ap-aging",
    title: "Umur Utang",
    description: "Tagihan pembelian yang belum lunas beserta umur jatuh tempo.",
    roles: ["ADMIN", "MANAGER", "FINANCE_STAFF"],
    columns: [
      { key: "bill", label: "Tagihan" },
      { key: "supplier", label: "Supplier" },
      { key: "billDate", label: "Tanggal", format: "date" },
      { key: "dueDate", label: "Jatuh Tempo", format: "date" },
      { key: "total", label: "Total", align: "right", format: "number" },
      { key: "paid", label: "Dibayar", align: "right", format: "number" },
      { key: "outstanding", label: "Sisa", align: "right", format: "number" },
      { key: "ageDays", label: "Umur (hari)", align: "right", format: "number" },
      { key: "bucket", label: "Kategori" },
    ],
  },
  {
    slug: "payroll-summary",
    title: "Rekap Payroll",
    description: "Ringkasan payroll per periode beserta komponen gaji dan kontribusi perusahaan.",
    roles: ["ADMIN", "MANAGER", "HR_STAFF", "PAYROLL_ADMIN", "FINANCE_STAFF"],
    columns: [
      { key: "number", label: "Nomor Payroll" },
      { key: "period", label: "Periode" },
      { key: "status", label: "Status" },
      { key: "employees", label: "Karyawan", align: "right", format: "number" },
      { key: "gross", label: "Bruto", align: "right", format: "number" },
      { key: "deductions", label: "Potongan", align: "right", format: "number" },
      { key: "net", label: "Neto", align: "right", format: "number" },
      { key: "employer", label: "Kontribusi Perusahaan", align: "right", format: "number" },
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
/* Laporan keuangan                                                    */
/* ------------------------------------------------------------------ */

const FINANCE_STATUSES = ["POSTED", "REVERSED"] as const;

const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf",
  APPROVED: "Disetujui",
  PAID: "Dibayar",
  CANCELLED: "Dibatalkan",
};

function daysBetween(from: string, to: string): number {
  const start = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const end = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  );
  return Math.round((end - start) / 86_400_000);
}

function agingBucket(dueDate: string, asOf: string): { ageDays: number; bucket: string } {
  const ageDays = daysBetween(dueDate, asOf);
  if (ageDays <= 0) return { ageDays, bucket: "Belum jatuh tempo" };
  if (ageDays <= 30) return { ageDays, bucket: "1–30 hari" };
  if (ageDays <= 60) return { ageDays, bucket: "31–60 hari" };
  return { ageDays, bucket: "> 60 hari" };
}

async function trialBalanceRows(period: ReportPeriod): Promise<{
  rows: ReportRow[];
  summary: ReportSummaryItem[];
}> {
  const rows = await db
    .select({
      code: accounts.code,
      account: accounts.name,
      type: accounts.type,
      debit: sql<string>`coalesce(sum(case when ${journalEntries.status} in ('POSTED', 'REVERSED') and ${journalEntries.journalDate} >= ${period.from} and ${journalEntries.journalDate} <= ${period.to} then ${journalLines.debit} else 0 end), 0)`,
      credit: sql<string>`coalesce(sum(case when ${journalEntries.status} in ('POSTED', 'REVERSED') and ${journalEntries.journalDate} >= ${period.from} and ${journalEntries.journalDate} <= ${period.to} then ${journalLines.credit} else 0 end), 0)`,
    })
    .from(accounts)
    .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
    .leftJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(eq(accounts.isActive, true))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.code));

  let totalDebit = 0;
  let totalCredit = 0;
  const reportRows = rows
    .map((row) => {
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      totalDebit += debit;
      totalCredit += credit;
      return {
        code: row.code,
        account: row.account,
        type: ACCOUNT_TYPE_LABELS[row.type],
        debit,
        credit,
        balance: debit - credit,
      };
    })
    .filter((row) => row.debit !== 0 || row.credit !== 0);

  return {
    rows: reportRows,
    summary: [
      { label: "Total debit", value: formatIdr(totalDebit) },
      { label: "Total kredit", value: formatIdr(totalCredit) },
      {
        label: "Selisih",
        value: formatIdr(totalDebit - totalCredit),
      },
    ],
  };
}

async function incomeStatementRows(period: ReportPeriod): Promise<{
  rows: ReportRow[];
  summary: ReportSummaryItem[];
}> {
  const rows = await db
    .select({
      code: accounts.code,
      account: accounts.name,
      type: accounts.type,
      debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        inArray(journalEntries.status, [...FINANCE_STATUSES]),
        gte(journalEntries.journalDate, period.from),
        lte(journalEntries.journalDate, period.to),
        inArray(accounts.type, ["REVENUE", "EXPENSE"]),
      ),
    )
    .groupBy(accounts.id)
    .orderBy(asc(accounts.code));

  let revenue = 0;
  let expense = 0;
  const reportRows: ReportRow[] = [];
  for (const row of rows) {
    const amount =
      row.type === "REVENUE"
        ? Number(row.credit) - Number(row.debit)
        : Number(row.debit) - Number(row.credit);
    if (amount === 0) continue;
    if (row.type === "REVENUE") revenue += amount;
    else expense += amount;
    reportRows.push({
      section: row.type === "REVENUE" ? "Pendapatan" : "Beban",
      code: row.code,
      account: row.account,
      amount,
    });
  }

  return {
    rows: reportRows,
    summary: [
      { label: "Total pendapatan", value: formatIdr(revenue) },
      { label: "Total beban", value: formatIdr(expense) },
      { label: "Laba bersih", value: formatIdr(revenue - expense) },
    ],
  };
}

async function balanceSheetRows(period: ReportPeriod): Promise<{
  rows: ReportRow[];
  summary: ReportSummaryItem[];
}> {
  const rows = await db
    .select({
      code: accounts.code,
      account: accounts.name,
      type: accounts.type,
      debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        inArray(journalEntries.status, [...FINANCE_STATUSES]),
        lte(journalEntries.journalDate, period.to),
        inArray(accounts.type, ["ASSET", "LIABILITY", "EQUITY"]),
      ),
    )
    .groupBy(accounts.id)
    .orderBy(asc(accounts.code));

  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  const reportRows: ReportRow[] = [];
  for (const row of rows) {
    const amount =
      row.type === "ASSET"
        ? Number(row.debit) - Number(row.credit)
        : Number(row.credit) - Number(row.debit);
    if (amount === 0) continue;
    if (row.type === "ASSET") assets += amount;
    else if (row.type === "LIABILITY") liabilities += amount;
    else equity += amount;
    reportRows.push({
      section:
        row.type === "ASSET" ? "Aset" : row.type === "LIABILITY" ? "Kewajiban" : "Ekuitas",
      code: row.code,
      account: row.account,
      amount,
    });
  }

  const [profit] = await db
    .select({
      value: sql<string>`coalesce(sum(case when ${accounts.type} = 'REVENUE' then ${journalLines.credit} - ${journalLines.debit} when ${accounts.type} = 'EXPENSE' then ${journalLines.debit} - ${journalLines.credit} else 0 end), 0)`,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        inArray(journalEntries.status, [...FINANCE_STATUSES]),
        lte(journalEntries.journalDate, period.to),
      ),
    );
  const netIncome = Number(profit?.value ?? 0);
  if (netIncome !== 0) {
    equity += netIncome;
    reportRows.push({
      section: "Ekuitas",
      code: "—",
      account: "Laba periode berjalan",
      amount: netIncome,
    });
  }

  return {
    rows: reportRows,
    summary: [
      { label: "Total aset", value: formatIdr(assets) },
      { label: "Total kewajiban", value: formatIdr(liabilities) },
      { label: "Total ekuitas", value: formatIdr(equity) },
    ],
  };
}

async function generalLedgerRows(period: ReportPeriod): Promise<ReportRow[]> {
  const rows = await db
    .select({
      date: journalEntries.journalDate,
      journal: journalEntries.number,
      account: sql<string>`${accounts.code} || ' — ' || ${accounts.name}`,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        inArray(journalEntries.status, [...FINANCE_STATUSES]),
        gte(journalEntries.journalDate, period.from),
        lte(journalEntries.journalDate, period.to),
      ),
    )
    .orderBy(asc(journalEntries.journalDate), asc(journalEntries.number), asc(accounts.code));

  return rows.map((row) => ({
    ...row,
    debit: Number(row.debit),
    credit: Number(row.credit),
  }));
}

async function cashFlowRows(period: ReportPeriod): Promise<{
  rows: ReportRow[];
  summary: ReportSummaryItem[];
}> {
  const rows = await db
    .select({
      date: journalEntries.journalDate,
      journal: journalEntries.number,
      description: journalEntries.description,
      category: journalEntries.cashFlowCategory,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.isCashBank, true),
        inArray(journalEntries.status, [...FINANCE_STATUSES]),
        gte(journalEntries.journalDate, period.from),
        lte(journalEntries.journalDate, period.to),
      ),
    )
    .orderBy(asc(journalEntries.journalDate), asc(journalEntries.number));

  let inflow = 0;
  let outflow = 0;
  const reportRows = rows.map((row) => {
    const cashIn = Number(row.debit);
    const cashOut = Number(row.credit);
    inflow += cashIn;
    outflow += cashOut;
    return {
      date: row.date,
      journal: row.journal,
      description: row.description,
      category: CASH_FLOW_LABELS[row.category],
      inflow: cashIn,
      outflow: cashOut,
      net: cashIn - cashOut,
    };
  });

  return {
    rows: reportRows,
    summary: [
      { label: "Kas masuk", value: formatIdr(inflow) },
      { label: "Kas keluar", value: formatIdr(outflow) },
      { label: "Arus kas neto", value: formatIdr(inflow - outflow) },
    ],
  };
}

async function receivableAgingRows(period: ReportPeriod): Promise<{
  rows: ReportRow[];
  summary: ReportSummaryItem[];
}> {
  const rows = await db
    .select({
      invoice: salesInvoices.number,
      buyer: buyers.name,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      total: salesInvoices.total,
      paid: salesInvoices.amountPaid,
      outstanding: sql<string>`(${salesInvoices.total} - ${salesInvoices.amountPaid})`,
    })
    .from(salesInvoices)
    .innerJoin(buyers, eq(salesInvoices.buyerId, buyers.id))
    .where(
      and(
        ne(salesInvoices.status, "PAID"),
        ne(salesInvoices.status, "CANCELLED"),
        lte(salesInvoices.invoiceDate, period.to),
      ),
    )
    .orderBy(asc(salesInvoices.dueDate), asc(salesInvoices.number));

  let outstandingTotal = 0;
  const reportRows = rows.map((row) => {
    const outstanding = Number(row.outstanding);
    outstandingTotal += outstanding;
    const { ageDays, bucket } = agingBucket(row.dueDate, period.to);
    return {
      invoice: row.invoice,
      buyer: row.buyer,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      total: Number(row.total),
      paid: Number(row.paid),
      outstanding,
      ageDays,
      bucket,
    };
  });

  return {
    rows: reportRows,
    summary: [
      { label: "Total piutang", value: formatIdr(outstandingTotal) },
      {
        label: "Faktur belum lunas",
        value: `${reportRows.length.toLocaleString("id-ID")} faktur`,
      },
      {
        label: "Lewat jatuh tempo",
        value: `${reportRows.filter((row) => Number(row.ageDays) > 0).length.toLocaleString("id-ID")} faktur`,
      },
    ],
  };
}

async function payableAgingRows(period: ReportPeriod): Promise<{
  rows: ReportRow[];
  summary: ReportSummaryItem[];
}> {
  const rows = await db
    .select({
      bill: purchaseBills.number,
      supplier: suppliers.name,
      billDate: purchaseBills.billDate,
      dueDate: purchaseBills.dueDate,
      total: purchaseBills.total,
      paid: purchaseBills.amountPaid,
      outstanding: sql<string>`(${purchaseBills.total} - ${purchaseBills.amountPaid})`,
    })
    .from(purchaseBills)
    .innerJoin(suppliers, eq(purchaseBills.supplierId, suppliers.id))
    .where(
      and(
        ne(purchaseBills.status, "PAID"),
        ne(purchaseBills.status, "CANCELLED"),
        lte(purchaseBills.billDate, period.to),
      ),
    )
    .orderBy(asc(purchaseBills.dueDate), asc(purchaseBills.number));

  let outstandingTotal = 0;
  const reportRows = rows.map((row) => {
    const outstanding = Number(row.outstanding);
    outstandingTotal += outstanding;
    const { ageDays, bucket } = agingBucket(row.dueDate, period.to);
    return {
      bill: row.bill,
      supplier: row.supplier,
      billDate: row.billDate,
      dueDate: row.dueDate,
      total: Number(row.total),
      paid: Number(row.paid),
      outstanding,
      ageDays,
      bucket,
    };
  });

  return {
    rows: reportRows,
    summary: [
      { label: "Total utang", value: formatIdr(outstandingTotal) },
      {
        label: "Tagihan belum lunas",
        value: `${reportRows.length.toLocaleString("id-ID")} tagihan`,
      },
      {
        label: "Lewat jatuh tempo",
        value: `${reportRows.filter((row) => Number(row.ageDays) > 0).length.toLocaleString("id-ID")} tagihan`,
      },
    ],
  };
}

async function payrollSummaryRows(period: ReportPeriod): Promise<{
  rows: ReportRow[];
  summary: ReportSummaryItem[];
}> {
  const rows = await db
    .select({
      number: payrollRuns.number,
      period: payrollRuns.period,
      status: payrollRuns.status,
      employees: sql<number>`(select count(*)::int from payslips p where p.payroll_run_id = payroll_runs.id)`,
      gross: payrollRuns.totalGross,
      deductions: payrollRuns.totalDeductions,
      net: payrollRuns.totalNet,
      employer: payrollRuns.totalEmployerContributions,
    })
    .from(payrollRuns)
    .where(
      and(
        gte(payrollRuns.period, period.from.slice(0, 7)),
        lte(payrollRuns.period, period.to.slice(0, 7)),
        ne(payrollRuns.status, "CANCELLED"),
      ),
    )
    .orderBy(asc(payrollRuns.period), asc(payrollRuns.number));

  let gross = 0;
  let net = 0;
  let employer = 0;
  const reportRows = rows.map((row) => {
    gross += Number(row.gross);
    net += Number(row.net);
    employer += Number(row.employer);
    return {
      number: row.number,
      period: row.period,
      status: PAYROLL_STATUS_LABELS[row.status] ?? row.status,
      employees: Number(row.employees),
      gross: Number(row.gross),
      deductions: Number(row.deductions),
      net: Number(row.net),
      employer: Number(row.employer),
    };
  });

  return {
    rows: reportRows,
    summary: [
      { label: "Total bruto", value: formatIdr(gross) },
      { label: "Total neto", value: formatIdr(net) },
      { label: "Kontribusi perusahaan", value: formatIdr(employer) },
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
    case "trial-balance": {
      const result = await trialBalanceRows(period);
      rows = result.rows;
      summary = result.summary;
      break;
    }
    case "income-statement": {
      const result = await incomeStatementRows(period);
      rows = result.rows;
      summary = result.summary;
      break;
    }
    case "balance-sheet": {
      const result = await balanceSheetRows(period);
      rows = result.rows;
      summary = result.summary;
      break;
    }
    case "general-ledger":
      rows = await generalLedgerRows(period);
      break;
    case "cash-flow": {
      const result = await cashFlowRows(period);
      rows = result.rows;
      summary = result.summary;
      break;
    }
    case "ar-aging": {
      const result = await receivableAgingRows(period);
      rows = result.rows;
      summary = result.summary;
      break;
    }
    case "ap-aging": {
      const result = await payableAgingRows(period);
      rows = result.rows;
      summary = result.summary;
      break;
    }
    case "payroll-summary": {
      const result = await payrollSummaryRows(period);
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
