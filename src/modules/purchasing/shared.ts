import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { type DbExecutor, type DbTransaction } from "@/lib/db";
import {
  materialReceiptItems,
  materialReceipts,
  materials,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  unitsOfMeasure,
  warehouseLocations,
} from "@/lib/db/schema";
import { nullable } from "@/lib/utils/strings";
import { toQuantityString } from "@/modules/inventory/engine";
import type { MaterialReceiptFormInput, PurchaseOrderFormInput } from "./schemas";
import { resolvePurchaseOrderStatus, type PurchaseOrderStatus } from "./status";

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type MaterialReceipt = typeof materialReceipts.$inferSelect;

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

export function toScaled(value: number): number {
  return Math.round(value * 10_000);
}

export function remainingQuantity(ordered: string, accepted: string): string {
  return ((toScaled(Number(ordered)) - toScaled(Number(accepted))) / 10_000).toFixed(4);
}

/* ------------------------------------------------------------------ */
/* Query baca                                                          */
/* ------------------------------------------------------------------ */
export async function loadPurchaseOrderItemsProgress(
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
export async function lockPurchaseOrder(
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

export async function assertSupplierActive(
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

export async function assertMaterialsActive(tx: DbTransaction, materialIds: string[]): Promise<void> {
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

export async function assertLocationActive(
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

export function toPurchaseOrderItemRows(purchaseOrderId: string, input: PurchaseOrderFormInput) {
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
export async function assertReceiptItemsValid(
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
export async function refreshPurchaseOrderStatus(
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

export function notReceivableMessage(status: PurchaseOrderStatus): string {
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
