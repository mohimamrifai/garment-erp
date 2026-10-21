import { asc, eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import {
  materialReceiptItems,
  materialReceipts,
  materials,
  purchaseOrderItems,
  unitsOfMeasure,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { postMovement, toQuantityString } from "@/modules/inventory/engine";
import type { CancelMaterialReceiptInput, MaterialReceiptFormInput } from "./schemas";
import {
  assertLocationActive,
  assertReceiptItemsValid,
  loadPurchaseOrderItemsProgress,
  lockPurchaseOrder,
  notReceivableMessage,
  refreshPurchaseOrderStatus,
  toScaled,
  type MaterialReceipt,
} from "./shared";
import { canReceivePurchaseOrder, isEditableReceiptStatus } from "./status";

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

