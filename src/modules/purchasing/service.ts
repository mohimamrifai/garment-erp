import { and, asc, count, desc, eq, ilike, inArray, lt, lte, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor, type DbTransaction } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  inventoryTransactions,
  materialReceiptItems,
  materialReceipts,
  materials,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  unitsOfMeasure,
  warehouseLocations,
  warehouses,
} from "@/lib/db/schema";
import { getDateOffset, getTodayDate } from "@/lib/utils/dates";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { postMovement, toQuantityString } from "@/modules/inventory/engine";
import type {
  CancelMaterialReceiptInput,
  CancelPurchaseOrderInput,
  ListMaterialReceiptsQuery,
  ListPurchaseOrdersQuery,
  MaterialReceiptFormInput,
  PurchaseOrderFormInput,
} from "./schemas";
import {
  canCancelPurchaseOrder,
  canOrderPurchaseOrder,
  canReceivePurchaseOrder,
  isEditablePurchaseOrderStatus,
  isEditableReceiptStatus,
  OPEN_PO_STATUSES,
  resolvePurchaseOrderStatus,
  type MaterialReceiptStatus,
  type PurchaseOrderStatus,
} from "./status";

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type MaterialReceipt = typeof materialReceipts.$inferSelect;

function toScaled(value: number): number {
  return Math.round(value * 10_000);
}

function remainingQuantity(ordered: string, accepted: string): string {
  return ((toScaled(Number(ordered)) - toScaled(Number(accepted))) / 10_000).toFixed(4);
}

/* ------------------------------------------------------------------ */
/* Query baca                                                          */
/* ------------------------------------------------------------------ */

export type PurchaseOrderListRow = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  createdAt: Date;
  itemCount: number;
  totalOrdered: string;
  totalReceived: string;
  totalValue: string;
};

/** Total diterima baik per PO (hanya penerimaan berstatus POSTED). */
async function acceptedTotalByPurchaseOrder(
  executor: DbExecutor,
  purchaseOrderIds: string[],
): Promise<Map<string, string>> {
  if (purchaseOrderIds.length === 0) return new Map();
  const rows = await executor
    .select({
      purchaseOrderId: materialReceipts.purchaseOrderId,
      accepted: sql<string>`coalesce(sum(${materialReceiptItems.acceptedQuantity}), 0)`,
    })
    .from(materialReceiptItems)
    .innerJoin(materialReceipts, eq(materialReceipts.id, materialReceiptItems.materialReceiptId))
    .where(
      and(
        eq(materialReceipts.status, "POSTED"),
        inArray(materialReceipts.purchaseOrderId, purchaseOrderIds),
      ),
    )
    .groupBy(materialReceipts.purchaseOrderId);
  return new Map(rows.map((row) => [row.purchaseOrderId, row.accepted]));
}

export async function listPurchaseOrders(
  params: ListPurchaseOrdersQuery,
): Promise<{ items: PurchaseOrderListRow[]; total: number }> {
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(purchaseOrders.number, pattern), ilike(suppliers.name, pattern)));
  }
  if (params.status !== "all") conditions.push(eq(purchaseOrders.status, params.status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(where);

  const rows = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
      createdAt: purchaseOrders.createdAt,
      itemCount: sql<number>`count(${purchaseOrderItems.id})::int`,
      totalOrdered: sql<string>`coalesce(sum(${purchaseOrderItems.orderedQuantity}), 0)`,
      totalValue: sql<string>`coalesce(sum(${purchaseOrderItems.orderedQuantity} * ${purchaseOrderItems.unitPrice}), 0)`,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .where(where)
    .groupBy(purchaseOrders.id, suppliers.id)
    .orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const acceptedByPo = await acceptedTotalByPurchaseOrder(
    db,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => ({
      ...row,
      totalReceived: acceptedByPo.get(row.id) ?? "0",
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

export type PurchaseOrderItemRow = {
  id: string;
  purchaseOrderId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  orderedQuantity: string;
  acceptedQuantity: string;
  remainingQuantity: string;
  unitPrice: string;
  notes: string | null;
};

export type PurchaseOrderDetail = {
  order: PurchaseOrder;
  supplier: {
    id: string;
    code: string;
    name: string;
    contactPerson: string | null;
    phone: string | null;
  };
  items: PurchaseOrderItemRow[];
  receipts: {
    id: string;
    number: string;
    receivedAt: string;
    status: MaterialReceiptStatus;
    locationCode: string;
    locationName: string;
    createdAt: Date;
    itemCount: number;
    totalReceived: string;
    totalAccepted: string;
  }[];
  totals: {
    itemCount: number;
    totalOrdered: number;
    totalAccepted: number;
    totalValue: string;
  };
};

export async function getPurchaseOrderDetail(purchaseOrderId: string): Promise<PurchaseOrderDetail> {
  const [row] = await db
    .select({
      order: purchaseOrders,
      supplier: {
        id: suppliers.id,
        code: suppliers.code,
        name: suppliers.name,
        contactPerson: suppliers.contactPerson,
        phone: suppliers.phone,
      },
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, purchaseOrderId))
    .limit(1);

  if (!row) throw ApiError.notFound("Purchase order tidak ditemukan.");

  const items = await loadPurchaseOrderItemsProgress(db, [purchaseOrderId]);

  const receipts = await db
    .select({
      id: materialReceipts.id,
      number: materialReceipts.number,
      receivedAt: materialReceipts.receivedAt,
      status: materialReceipts.status,
      locationCode: warehouseLocations.code,
      locationName: warehouseLocations.name,
      createdAt: materialReceipts.createdAt,
      itemCount: sql<number>`count(${materialReceiptItems.id})::int`,
      totalReceived: sql<string>`coalesce(sum(${materialReceiptItems.receivedQuantity}), 0)`,
      totalAccepted: sql<string>`coalesce(sum(${materialReceiptItems.acceptedQuantity}), 0)`,
    })
    .from(materialReceipts)
    .innerJoin(warehouseLocations, eq(materialReceipts.locationId, warehouseLocations.id))
    .leftJoin(materialReceiptItems, eq(materialReceiptItems.materialReceiptId, materialReceipts.id))
    .where(eq(materialReceipts.purchaseOrderId, purchaseOrderId))
    .groupBy(materialReceipts.id, warehouseLocations.id)
    .orderBy(desc(materialReceipts.createdAt));

  const totalAccepted = items.reduce((sum, item) => sum + toScaled(Number(item.acceptedQuantity)), 0);
  const totalOrdered = items.reduce((sum, item) => sum + toScaled(Number(item.orderedQuantity)), 0);
  const totalValue = items
    .reduce(
      (sum, item) => sum + (toScaled(Number(item.orderedQuantity)) / 10_000) * Number(item.unitPrice),
      0,
    )
    .toFixed(2);

  return {
    order: row.order,
    supplier: row.supplier,
    items,
    receipts,
    totals: {
      itemCount: items.length,
      totalOrdered: totalOrdered / 10_000,
      totalAccepted: totalAccepted / 10_000,
      totalValue,
    },
  };
}

/** Item PO beserta jumlah yang sudah diterima baik (hanya penerimaan POSTED). */
async function loadPurchaseOrderItemsProgress(
  executor: DbExecutor,
  purchaseOrderIds: string[],
): Promise<PurchaseOrderItemRow[]> {
  if (purchaseOrderIds.length === 0) return [];

  const itemRows = await executor
    .select({
      id: purchaseOrderItems.id,
      purchaseOrderId: purchaseOrderItems.purchaseOrderId,
      materialId: purchaseOrderItems.materialId,
      materialCode: materials.code,
      materialName: materials.name,
      unitCode: unitsOfMeasure.code,
      orderedQuantity: purchaseOrderItems.orderedQuantity,
      unitPrice: purchaseOrderItems.unitPrice,
      notes: purchaseOrderItems.notes,
    })
    .from(purchaseOrderItems)
    .innerJoin(materials, eq(purchaseOrderItems.materialId, materials.id))
    .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
    .where(inArray(purchaseOrderItems.purchaseOrderId, purchaseOrderIds))
    .orderBy(asc(materials.name));

  const acceptedRows = await executor
    .select({
      purchaseOrderItemId: materialReceiptItems.purchaseOrderItemId,
      accepted: sql<string>`coalesce(sum(${materialReceiptItems.acceptedQuantity}), 0)`,
    })
    .from(materialReceiptItems)
    .innerJoin(materialReceipts, eq(materialReceipts.id, materialReceiptItems.materialReceiptId))
    .where(
      and(
        eq(materialReceipts.status, "POSTED"),
        inArray(materialReceipts.purchaseOrderId, purchaseOrderIds),
      ),
    )
    .groupBy(materialReceiptItems.purchaseOrderItemId);

  const acceptedByItem = new Map(acceptedRows.map((row) => [row.purchaseOrderItemId, row.accepted]));

  return itemRows.map((item) => {
    const accepted = acceptedByItem.get(item.id) ?? "0";
    return {
      id: item.id,
      purchaseOrderId: item.purchaseOrderId,
      materialId: item.materialId,
      materialCode: item.materialCode,
      materialName: item.materialName,
      unitCode: item.unitCode,
      orderedQuantity: item.orderedQuantity,
      acceptedQuantity: accepted,
      remainingQuantity: remainingQuantity(item.orderedQuantity, accepted),
      unitPrice: item.unitPrice,
      notes: item.notes,
    };
  });
}

/** PO terbuka dengan sisa penerimaan — untuk form penerimaan & tombol "Terima". */
export type ReceivablePurchaseOrderOption = {
  id: string;
  number: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  /** Total sisa semua item (dalam satuan campuran — hanya untuk tampilan). */
  remainingQuantity: string;
};

export async function listReceivablePurchaseOrders(): Promise<ReceivablePurchaseOrderOption[]> {
  const orders = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      supplierName: suppliers.name,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(inArray(purchaseOrders.status, OPEN_PO_STATUSES))
    .orderBy(asc(purchaseOrders.expectedDate), asc(purchaseOrders.number));

  const items = await loadPurchaseOrderItemsProgress(
    db,
    orders.map((order) => order.id),
  );
  const remainingByPo = new Map<string, number>();
  for (const item of items) {
    remainingByPo.set(
      item.purchaseOrderId as string,
      (remainingByPo.get(item.purchaseOrderId as string) ?? 0) +
        toScaled(Number(item.remainingQuantity)),
    );
  }

  return orders
    .map((order) => ({
      ...order,
      remainingQuantity: ((remainingByPo.get(order.id) ?? 0) / 10_000).toFixed(4),
    }))
    .filter((order) => toScaled(Number(order.remainingQuantity)) > 0);
}

export type MaterialReceiptListRow = {
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierName: string;
  receivedAt: string;
  status: MaterialReceiptStatus;
  locationCode: string;
  locationName: string;
  warehouseName: string;
  createdAt: Date;
  itemCount: number;
  totalReceived: string;
  totalAccepted: string;
};

export async function listMaterialReceipts(
  params: ListMaterialReceiptsQuery,
): Promise<{ items: MaterialReceiptListRow[]; total: number }> {
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(materialReceipts.number, pattern),
        ilike(purchaseOrders.number, pattern),
        ilike(suppliers.name, pattern),
      ),
    );
  }
  if (params.status !== "all") conditions.push(eq(materialReceipts.status, params.status));
  if (params.po) conditions.push(eq(materialReceipts.purchaseOrderId, params.po));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(materialReceipts)
    .innerJoin(purchaseOrders, eq(materialReceipts.purchaseOrderId, purchaseOrders.id))
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(where);

  const rows = await db
    .select({
      id: materialReceipts.id,
      number: materialReceipts.number,
      purchaseOrderId: materialReceipts.purchaseOrderId,
      purchaseOrderNumber: purchaseOrders.number,
      supplierName: suppliers.name,
      receivedAt: materialReceipts.receivedAt,
      status: materialReceipts.status,
      locationCode: warehouseLocations.code,
      locationName: warehouseLocations.name,
      warehouseName: warehouses.name,
      createdAt: materialReceipts.createdAt,
      itemCount: sql<number>`count(${materialReceiptItems.id})::int`,
      totalReceived: sql<string>`coalesce(sum(${materialReceiptItems.receivedQuantity}), 0)`,
      totalAccepted: sql<string>`coalesce(sum(${materialReceiptItems.acceptedQuantity}), 0)`,
    })
    .from(materialReceipts)
    .innerJoin(purchaseOrders, eq(materialReceipts.purchaseOrderId, purchaseOrders.id))
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(warehouseLocations, eq(materialReceipts.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .leftJoin(materialReceiptItems, eq(materialReceiptItems.materialReceiptId, materialReceipts.id))
    .where(where)
    .groupBy(materialReceipts.id, purchaseOrders.id, suppliers.id, warehouseLocations.id, warehouses.id)
    .orderBy(desc(materialReceipts.createdAt), desc(materialReceipts.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items: rows, total: Number(totalRow?.value ?? 0) };
}

export type MaterialReceiptItemRow = {
  id: string;
  purchaseOrderItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  orderedQuantity: string;
  receivedQuantity: string;
  acceptedQuantity: string;
  notes: string | null;
};

export type MaterialReceiptDetail = {
  receipt: MaterialReceipt;
  purchaseOrder: {
    id: string;
    number: string;
    status: PurchaseOrderStatus;
    orderDate: string;
    supplierId: string;
    supplierName: string;
  };
  location: {
    id: string;
    code: string;
    name: string;
    warehouseId: string;
    warehouseName: string;
  };
  items: MaterialReceiptItemRow[];
  transactions: {
    id: string;
    number: string;
    materialId: string | null;
    quantity: string;
    postedAt: Date;
    postedByName: string | null;
  }[];
  totals: {
    itemCount: number;
    totalReceived: number;
    totalAccepted: number;
  };
};

export async function getMaterialReceiptDetail(
  materialReceiptId: string,
): Promise<MaterialReceiptDetail> {
  const [row] = await db
    .select({
      receipt: materialReceipts,
      purchaseOrder: {
        id: purchaseOrders.id,
        number: purchaseOrders.number,
        status: purchaseOrders.status,
        orderDate: purchaseOrders.orderDate,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
      },
      location: {
        id: warehouseLocations.id,
        code: warehouseLocations.code,
        name: warehouseLocations.name,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      },
    })
    .from(materialReceipts)
    .innerJoin(purchaseOrders, eq(materialReceipts.purchaseOrderId, purchaseOrders.id))
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(warehouseLocations, eq(materialReceipts.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .where(eq(materialReceipts.id, materialReceiptId))
    .limit(1);

  if (!row) throw ApiError.notFound("Penerimaan material tidak ditemukan.");

  const items = await db
    .select({
      id: materialReceiptItems.id,
      purchaseOrderItemId: materialReceiptItems.purchaseOrderItemId,
      materialId: purchaseOrderItems.materialId,
      materialCode: materials.code,
      materialName: materials.name,
      unitCode: unitsOfMeasure.code,
      orderedQuantity: purchaseOrderItems.orderedQuantity,
      receivedQuantity: materialReceiptItems.receivedQuantity,
      acceptedQuantity: materialReceiptItems.acceptedQuantity,
      notes: materialReceiptItems.notes,
    })
    .from(materialReceiptItems)
    .innerJoin(purchaseOrderItems, eq(materialReceiptItems.purchaseOrderItemId, purchaseOrderItems.id))
    .innerJoin(materials, eq(purchaseOrderItems.materialId, materials.id))
    .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
    .where(eq(materialReceiptItems.materialReceiptId, materialReceiptId))
    .orderBy(asc(materials.name));

  const transactions = await db
    .select({
      id: inventoryTransactions.id,
      number: inventoryTransactions.number,
      materialId: inventoryTransactions.materialId,
      quantity: inventoryTransactions.quantity,
      postedAt: inventoryTransactions.postedAt,
      postedByName: user.name,
    })
    .from(inventoryTransactions)
    .leftJoin(user, eq(inventoryTransactions.postedBy, user.id))
    .where(
      and(
        eq(inventoryTransactions.referenceType, "material-receipt"),
        eq(inventoryTransactions.referenceId, materialReceiptId),
      ),
    )
    .orderBy(asc(inventoryTransactions.number));

  const totalReceived = items.reduce(
    (sum, item) => sum + toScaled(Number(item.receivedQuantity)),
    0,
  );
  const totalAccepted = items.reduce(
    (sum, item) => sum + toScaled(Number(item.acceptedQuantity)),
    0,
  );

  return {
    receipt: row.receipt,
    purchaseOrder: row.purchaseOrder,
    location: row.location,
    items,
    transactions,
    totals: {
      itemCount: items.length,
      totalReceived: totalReceived / 10_000,
      totalAccepted: totalAccepted / 10_000,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Guard & helper tulis                                                */
/* ------------------------------------------------------------------ */

async function lockPurchaseOrder(
  tx: DbTransaction,
  purchaseOrderId: string,
): Promise<PurchaseOrder> {
  const [order] = await tx
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, purchaseOrderId))
    .limit(1)
    .for("update");
  if (!order) throw ApiError.notFound("Purchase order tidak ditemukan.");
  return order;
}

async function assertSupplierActive(
  tx: DbTransaction,
  supplierId: string,
): Promise<{ id: string; name: string }> {
  const [supplier] = await tx
    .select({ id: suppliers.id, name: suppliers.name, isActive: suppliers.isActive })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier) throw ApiError.badRequest("Supplier tidak ditemukan.");
  if (!supplier.isActive) throw ApiError.badRequest(`Supplier ${supplier.name} sedang nonaktif.`);
  return supplier;
}

async function assertMaterialsActive(tx: DbTransaction, materialIds: string[]): Promise<void> {
  const rows = await tx
    .select({ id: materials.id, name: materials.name, isActive: materials.isActive })
    .from(materials)
    .where(inArray(materials.id, [...new Set(materialIds)]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const materialId of materialIds) {
    const material = byId.get(materialId);
    if (!material) throw ApiError.badRequest("Ada material yang tidak ditemukan.");
    if (!material.isActive) throw ApiError.badRequest(`Material ${material.name} sedang nonaktif.`);
  }
}

async function assertLocationActive(
  tx: DbTransaction,
  locationId: string,
): Promise<{ id: string; code: string; name: string }> {
  const [location] = await tx
    .select({
      id: warehouseLocations.id,
      code: warehouseLocations.code,
      name: warehouseLocations.name,
      isActive: warehouseLocations.isActive,
    })
    .from(warehouseLocations)
    .where(eq(warehouseLocations.id, locationId))
    .limit(1);
  if (!location) throw ApiError.badRequest("Lokasi gudang tidak ditemukan.");
  if (!location.isActive) {
    throw ApiError.badRequest(`Lokasi ${location.code} sedang nonaktif.`);
  }
  return location;
}

function toPurchaseOrderItemRows(purchaseOrderId: string, input: PurchaseOrderFormInput) {
  return input.items.map((item) => ({
    purchaseOrderId,
    materialId: item.materialId,
    orderedQuantity: toQuantityString(item.orderedQuantity),
    unitPrice: item.unitPrice.toFixed(2),
    notes: nullable(item.notes),
  }));
}

/**
 * Validasi item penerimaan terhadap PO: item harus milik PO, kuantitas
 * diterima baik tidak melebihi sisa pesanan (dihitung dari penerimaan yang
 * sudah diposting). Draf penerimaan lain tidak mengurangi sisa — guard final
 * dijalankan lagi saat posting.
 */
async function assertReceiptItemsValid(
  tx: DbTransaction,
  purchaseOrderId: string,
  input: MaterialReceiptFormInput,
): Promise<void> {
  const progress = await loadPurchaseOrderItemsProgress(tx, [purchaseOrderId]);
  const byId = new Map(progress.map((item) => [item.id, item]));

  for (const item of input.items) {
    const poItem = byId.get(item.purchaseOrderItemId);
    if (!poItem) {
      throw ApiError.badRequest("Ada item penerimaan yang bukan milik purchase order ini.");
    }
    if (toScaled(item.acceptedQuantity) > toScaled(Number(poItem.remainingQuantity))) {
      throw ApiError.conflict(
        `Jumlah diterima baik melebihi sisa pesanan ${poItem.materialName} (sisa ${Number(poItem.remainingQuantity)} ${poItem.unitCode}).`,
      );
    }
  }
}

/** Perbarui status PO dari progres penerimaan POSTED. Mengembalikan status baru. */
async function refreshPurchaseOrderStatus(
  tx: DbTransaction,
  purchaseOrderId: string,
): Promise<"RECEIVED" | "PARTIALLY_RECEIVED" | null> {
  const rows = await tx
    .select({
      ordered: purchaseOrderItems.orderedQuantity,
      accepted: sql<string>`coalesce(sum(case when ${materialReceipts.status} = 'POSTED' then ${materialReceiptItems.acceptedQuantity} else 0 end), 0)`,
    })
    .from(purchaseOrderItems)
    .leftJoin(
      materialReceiptItems,
      eq(materialReceiptItems.purchaseOrderItemId, purchaseOrderItems.id),
    )
    .leftJoin(materialReceipts, eq(materialReceipts.id, materialReceiptItems.materialReceiptId))
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
    .groupBy(purchaseOrderItems.id);

  const target = resolvePurchaseOrderStatus(
    rows.map((row) => ({ ordered: Number(row.ordered), accepted: Number(row.accepted) })),
  );
  if (target) {
    await tx.update(purchaseOrders).set({ status: target }).where(eq(purchaseOrders.id, purchaseOrderId));
  }
  return target;
}

function notReceivableMessage(status: PurchaseOrderStatus): string {
  switch (status) {
    case "DRAFT":
      return "Purchase order masih draf — pesan (order) dulu sebelum menerima barang.";
    case "CANCELLED":
      return "Purchase order yang dibatalkan tidak dapat diterima barangnya.";
    case "RECEIVED":
      return "Purchase order ini sudah diterima lengkap.";
    default:
      return "Purchase order tidak dapat menerima barang.";
  }
}

/* ------------------------------------------------------------------ */
/* Purchase Order                                                      */
/* ------------------------------------------------------------------ */

export async function createPurchaseOrder(
  input: PurchaseOrderFormInput,
  actorUserId: string,
): Promise<PurchaseOrder> {
  return db.transaction(async (tx) => {
    const supplier = await assertSupplierActive(tx, input.supplierId);
    await assertMaterialsActive(
      tx,
      input.items.map((item) => item.materialId),
    );

    const number = await nextDocumentNumber(tx, "PO");
    const [order] = await tx
      .insert(purchaseOrders)
      .values({
        number,
        supplierId: input.supplierId,
        orderDate: input.orderDate,
        expectedDate: nullable(input.expectedDate),
        status: "DRAFT",
        notes: nullable(input.notes),
        createdBy: actorUserId,
      })
      .returning();
    if (!order) throw ApiError.badRequest("Gagal membuat purchase order.");

    await tx.insert(purchaseOrderItems).values(toPurchaseOrderItemRows(order.id, input));

    await recordAudit(tx, {
      actorUserId,
      action: "purchase-order.create",
      entityType: "purchase-order",
      entityId: order.id,
      details: {
        number,
        supplierId: supplier.id,
        supplierName: supplier.name,
        itemCount: input.items.length,
      },
    });
    return order;
  });
}

export async function updatePurchaseOrder(
  purchaseOrderId: string,
  input: PurchaseOrderFormInput,
  actorUserId: string,
): Promise<PurchaseOrder> {
  return db.transaction(async (tx) => {
    const order = await lockPurchaseOrder(tx, purchaseOrderId);
    if (!isEditablePurchaseOrderStatus(order.status)) {
      throw ApiError.conflict("Hanya purchase order berstatus draf yang dapat diubah.");
    }

    const supplier = await assertSupplierActive(tx, input.supplierId);
    await assertMaterialsActive(
      tx,
      input.items.map((item) => item.materialId),
    );

    const [updated] = await tx
      .update(purchaseOrders)
      .set({
        supplierId: input.supplierId,
        orderDate: input.orderDate,
        expectedDate: nullable(input.expectedDate),
        notes: nullable(input.notes),
      })
      .where(eq(purchaseOrders.id, purchaseOrderId))
      .returning();
    if (!updated) throw ApiError.notFound("Purchase order tidak ditemukan.");

    await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
    await tx.insert(purchaseOrderItems).values(toPurchaseOrderItemRows(purchaseOrderId, input));

    await recordAudit(tx, {
      actorUserId,
      action: "purchase-order.update",
      entityType: "purchase-order",
      entityId: purchaseOrderId,
      details: {
        number: order.number,
        supplierFrom: order.supplierId,
        supplierTo: supplier.id,
        itemCount: input.items.length,
      },
    });
    return updated;
  });
}

export async function orderPurchaseOrder(
  purchaseOrderId: string,
  actorUserId: string,
): Promise<PurchaseOrder> {
  return db.transaction(async (tx) => {
    const order = await lockPurchaseOrder(tx, purchaseOrderId);

    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Purchase order yang dibatalkan tidak dapat dipesan ulang.");
    }
    if (!canOrderPurchaseOrder(order.status)) {
      throw ApiError.conflict("Purchase order ini sudah dipesan.");
    }

    const [itemCount] = await tx
      .select({ value: count() })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
    if (Number(itemCount?.value ?? 0) === 0) {
      throw ApiError.conflict("Purchase order tanpa item tidak dapat dipesan.");
    }

    const [updated] = await tx
      .update(purchaseOrders)
      .set({ status: "ORDERED", orderedAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrderId))
      .returning();
    if (!updated) throw ApiError.notFound("Purchase order tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "purchase-order.order",
      entityType: "purchase-order",
      entityId: purchaseOrderId,
      details: { number: order.number, fromStatus: order.status, toStatus: "ORDERED" },
    });
    return updated;
  });
}

export async function cancelPurchaseOrder(
  purchaseOrderId: string,
  input: CancelPurchaseOrderInput,
  actorUserId: string,
): Promise<PurchaseOrder> {
  return db.transaction(async (tx) => {
    const order = await lockPurchaseOrder(tx, purchaseOrderId);
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Purchase order ini sudah dibatalkan.");
    }
    if (!canCancelPurchaseOrder(order.status)) {
      throw ApiError.conflict(
        "Purchase order yang sudah ada penerimaan tidak dapat dibatalkan.",
      );
    }

    const [updated] = await tx
      .update(purchaseOrders)
      .set({ status: "CANCELLED", cancelReason: input.reason, cancelledAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrderId))
      .returning();
    if (!updated) throw ApiError.notFound("Purchase order tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "purchase-order.cancel",
      entityType: "purchase-order",
      entityId: purchaseOrderId,
      details: { number: order.number, reason: input.reason, fromStatus: order.status },
    });
    return updated;
  });
}

/* ------------------------------------------------------------------ */
/* Material Receipt                                                    */
/* ------------------------------------------------------------------ */

function toReceiptItemRows(materialReceiptId: string, input: MaterialReceiptFormInput) {
  return input.items.map((item) => ({
    materialReceiptId,
    purchaseOrderItemId: item.purchaseOrderItemId,
    receivedQuantity: toQuantityString(item.receivedQuantity),
    acceptedQuantity: toQuantityString(item.acceptedQuantity),
    notes: nullable(item.notes),
  }));
}

async function lockReceipt(
  tx: DbTransaction,
  materialReceiptId: string,
): Promise<MaterialReceipt> {
  const [receipt] = await tx
    .select()
    .from(materialReceipts)
    .where(eq(materialReceipts.id, materialReceiptId))
    .limit(1)
    .for("update");
  if (!receipt) throw ApiError.notFound("Penerimaan material tidak ditemukan.");
  return receipt;
}

export async function createMaterialReceipt(
  input: MaterialReceiptFormInput,
  actorUserId: string,
): Promise<MaterialReceipt> {
  return db.transaction(async (tx) => {
    const order = await lockPurchaseOrder(tx, input.purchaseOrderId);
    if (!canReceivePurchaseOrder(order.status)) {
      throw ApiError.conflict(notReceivableMessage(order.status));
    }
    const location = await assertLocationActive(tx, input.locationId);
    await assertReceiptItemsValid(tx, order.id, input);

    const number = await nextDocumentNumber(tx, "RCV");
    const [receipt] = await tx
      .insert(materialReceipts)
      .values({
        number,
        purchaseOrderId: order.id,
        receivedAt: input.receivedAt,
        locationId: input.locationId,
        status: "DRAFT",
        notes: nullable(input.notes),
        createdBy: actorUserId,
      })
      .returning();
    if (!receipt) throw ApiError.badRequest("Gagal membuat penerimaan material.");

    await tx.insert(materialReceiptItems).values(toReceiptItemRows(receipt.id, input));

    await recordAudit(tx, {
      actorUserId,
      action: "material-receipt.create",
      entityType: "material-receipt",
      entityId: receipt.id,
      details: {
        number,
        purchaseOrderNumber: order.number,
        locationCode: location.code,
        itemCount: input.items.length,
      },
    });
    return receipt;
  });
}

export async function updateMaterialReceipt(
  materialReceiptId: string,
  input: MaterialReceiptFormInput,
  actorUserId: string,
): Promise<MaterialReceipt> {
  return db.transaction(async (tx) => {
    const receipt = await lockReceipt(tx, materialReceiptId);
    if (!isEditableReceiptStatus(receipt.status)) {
      throw ApiError.conflict("Hanya penerimaan berstatus draf yang dapat diubah.");
    }
    if (input.purchaseOrderId !== receipt.purchaseOrderId) {
      throw ApiError.badRequest("Purchase order penerimaan tidak boleh diganti.");
    }

    const order = await lockPurchaseOrder(tx, receipt.purchaseOrderId);
    if (!canReceivePurchaseOrder(order.status)) {
      throw ApiError.conflict(notReceivableMessage(order.status));
    }
    const location = await assertLocationActive(tx, input.locationId);
    await assertReceiptItemsValid(tx, order.id, input);

    const [updated] = await tx
      .update(materialReceipts)
      .set({
        receivedAt: input.receivedAt,
        locationId: input.locationId,
        notes: nullable(input.notes),
      })
      .where(eq(materialReceipts.id, materialReceiptId))
      .returning();
    if (!updated) throw ApiError.notFound("Penerimaan material tidak ditemukan.");

    await tx
      .delete(materialReceiptItems)
      .where(eq(materialReceiptItems.materialReceiptId, materialReceiptId));
    await tx.insert(materialReceiptItems).values(toReceiptItemRows(materialReceiptId, input));

    await recordAudit(tx, {
      actorUserId,
      action: "material-receipt.update",
      entityType: "material-receipt",
      entityId: materialReceiptId,
      details: {
        number: receipt.number,
        purchaseOrderNumber: order.number,
        locationCode: location.code,
        itemCount: input.items.length,
      },
    });
    return updated;
  });
}

/**
 * Posting penerimaan (F3 task 3.4): stok masuk lewat inventory engine dalam
 * satu transaksi; dokumen menjadi immutable dan status PO diperbarui.
 */
export async function postMaterialReceipt(
  materialReceiptId: string,
  actorUserId: string,
): Promise<MaterialReceipt> {
  return db.transaction(async (tx) => {
    const receipt = await lockReceipt(tx, materialReceiptId);
    if (receipt.status === "POSTED") {
      throw ApiError.conflict("Penerimaan ini sudah diposting.");
    }
    if (receipt.status === "CANCELLED") {
      throw ApiError.conflict("Penerimaan yang dibatalkan tidak dapat diposting.");
    }

    const order = await lockPurchaseOrder(tx, receipt.purchaseOrderId);
    if (!canReceivePurchaseOrder(order.status)) {
      throw ApiError.conflict(notReceivableMessage(order.status));
    }

    const items = await tx
      .select({
        id: materialReceiptItems.id,
        purchaseOrderItemId: materialReceiptItems.purchaseOrderItemId,
        materialId: purchaseOrderItems.materialId,
        materialName: materials.name,
        unitCode: unitsOfMeasure.code,
        receivedQuantity: materialReceiptItems.receivedQuantity,
        acceptedQuantity: materialReceiptItems.acceptedQuantity,
      })
      .from(materialReceiptItems)
      .innerJoin(purchaseOrderItems, eq(materialReceiptItems.purchaseOrderItemId, purchaseOrderItems.id))
      .innerJoin(materials, eq(purchaseOrderItems.materialId, materials.id))
      .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
      .where(eq(materialReceiptItems.materialReceiptId, materialReceiptId))
      .orderBy(asc(materials.name));

    if (items.length === 0) {
      throw ApiError.conflict("Penerimaan tanpa item tidak dapat diposting.");
    }

    const acceptedByItem = new Map(
      (await loadPurchaseOrderItemsProgress(tx, [order.id])).map((item) => [
        item.id,
        item.remainingQuantity,
      ]),
    );

    let totalAccepted = 0;
    const movementNumbers: string[] = [];

    for (const item of items) {
      const accepted = Number(item.acceptedQuantity);
      if (accepted <= 0) continue;

      const remaining = acceptedByItem.get(item.purchaseOrderItemId);
      if (remaining === undefined) {
        throw ApiError.badRequest("Ada item penerimaan yang bukan milik purchase order ini.");
      }
      if (toScaled(accepted) > toScaled(Number(remaining))) {
        throw ApiError.conflict(
          `Jumlah diterima melebihi sisa pesanan ${item.materialName} (sisa ${Number(remaining)} ${item.unitCode}).`,
        );
      }

      const movement = await postMovement(tx, {
        itemType: "MATERIAL",
        materialId: item.materialId,
        transactionType: "RECEIPT",
        quantity: accepted,
        toLocationId: receipt.locationId,
        referenceType: "material-receipt",
        referenceId: receipt.id,
        notes: `Penerimaan ${receipt.number}`,
        idempotencyKey: `material-receipt:${receipt.id}:${item.id}`,
        postedBy: actorUserId,
      });
      totalAccepted += accepted;
      movementNumbers.push(movement.transaction.number);
    }

    if (toScaled(totalAccepted) <= 0) {
      throw ApiError.conflict("Minimal satu item harus diterima baik (lebih dari 0) untuk diposting.");
    }

    const [updated] = await tx
      .update(materialReceipts)
      .set({ status: "POSTED", postedAt: new Date(), postedBy: actorUserId })
      .where(eq(materialReceipts.id, materialReceiptId))
      .returning();
    if (!updated) throw ApiError.notFound("Penerimaan material tidak ditemukan.");

    const nextStatus = await refreshPurchaseOrderStatus(tx, order.id);

    await recordAudit(tx, {
      actorUserId,
      action: "material-receipt.post",
      entityType: "material-receipt",
      entityId: materialReceiptId,
      details: {
        number: receipt.number,
        purchaseOrderNumber: order.number,
        itemCount: items.length,
        totalAccepted,
        movements: movementNumbers,
        purchaseOrderStatus: nextStatus,
      },
    });
    return updated;
  });
}

export async function cancelMaterialReceipt(
  materialReceiptId: string,
  input: CancelMaterialReceiptInput,
  actorUserId: string,
): Promise<MaterialReceipt> {
  return db.transaction(async (tx) => {
    const receipt = await lockReceipt(tx, materialReceiptId);
    if (receipt.status === "POSTED") {
      throw ApiError.conflict(
        "Penerimaan yang sudah diposting tidak dapat dibatalkan — koreksi lewat penyesuaian stok.",
      );
    }
    if (receipt.status === "CANCELLED") {
      throw ApiError.conflict("Penerimaan ini sudah dibatalkan.");
    }

    const [updated] = await tx
      .update(materialReceipts)
      .set({ status: "CANCELLED", cancelReason: input.reason, cancelledAt: new Date() })
      .where(eq(materialReceipts.id, materialReceiptId))
      .returning();
    if (!updated) throw ApiError.notFound("Penerimaan material tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "material-receipt.cancel",
      entityType: "material-receipt",
      entityId: materialReceiptId,
      details: { number: receipt.number, reason: input.reason },
    });
    return updated;
  });
}

/* ------------------------------------------------------------------ */
/* Ringkasan dashboard (F3)                                            */
/* ------------------------------------------------------------------ */

export type DashboardPurchasingSummary = {
  openCount: number;
  draftCount: number;
  draftReceiptCount: number;
  dueSoonCount: number;
  overdueCount: number;
  nearest: {
    id: string;
    number: string;
    supplierName: string;
    expectedDate: string | null;
    status: PurchaseOrderStatus;
    remainingQuantity: string;
  }[];
};

export async function getDashboardPurchasingSummary(): Promise<DashboardPurchasingSummary> {
  const today = getTodayDate();
  const horizon = getDateOffset(7);
  const openCondition = inArray(purchaseOrders.status, OPEN_PO_STATUSES);

  const [counts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${openCondition})::int`,
      draft: sql<number>`count(*) filter (where ${eq(purchaseOrders.status, "DRAFT")})::int`,
      dueSoon: sql<number>`count(*) filter (where ${and(openCondition, lte(purchaseOrders.expectedDate, horizon))})::int`,
      overdue: sql<number>`count(*) filter (where ${and(openCondition, lt(purchaseOrders.expectedDate, today))})::int`,
    })
    .from(purchaseOrders);

  const [receiptCounts] = await db
    .select({
      draft: sql<number>`count(*) filter (where ${eq(materialReceipts.status, "DRAFT")})::int`,
    })
    .from(materialReceipts);

  const nearestRows = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      supplierName: suppliers.name,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(and(openCondition, lte(purchaseOrders.expectedDate, horizon)))
    .orderBy(asc(purchaseOrders.expectedDate), asc(purchaseOrders.number))
    .limit(5);

  const progress = await loadPurchaseOrderItemsProgress(
    db,
    nearestRows.map((row) => row.id),
  );
  const remainingByPo = new Map<string, number>();
  for (const item of progress) {
    const poId = item.purchaseOrderId;
    remainingByPo.set(poId, (remainingByPo.get(poId) ?? 0) + toScaled(Number(item.remainingQuantity)));
  }

  return {
    openCount: Number(counts?.open ?? 0),
    draftCount: Number(counts?.draft ?? 0),
    draftReceiptCount: Number(receiptCounts?.draft ?? 0),
    dueSoonCount: Number(counts?.dueSoon ?? 0),
    overdueCount: Number(counts?.overdue ?? 0),
    nearest: nearestRows.map((row) => ({
      ...row,
      remainingQuantity: ((remainingByPo.get(row.id) ?? 0) / 10_000).toFixed(4),
    })),
  };
}
