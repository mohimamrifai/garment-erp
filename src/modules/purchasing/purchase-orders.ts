import { count, eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { purchaseOrderItems, purchaseOrders } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import type { CancelPurchaseOrderInput, PurchaseOrderFormInput } from "./schemas";
import {
  assertMaterialsActive,
  assertSupplierActive,
  lockPurchaseOrder,
  toPurchaseOrderItemRows,
  type PurchaseOrder,
} from "./shared";
import { canCancelPurchaseOrder, canOrderPurchaseOrder, isEditablePurchaseOrderStatus } from "./status";

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
