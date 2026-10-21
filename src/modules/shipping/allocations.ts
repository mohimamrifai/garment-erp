import { eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { salesOrderItems } from "@/lib/db/schema";
import { postMovement } from "@/modules/inventory/engine";
import { SO_STATUS_LABELS } from "@/modules/sales-order/status";
import type { CreateAllocationInput, ReleaseAllocationInput } from "./schemas";
import {
  allocationRowsByItem,
  assertLocationActive,
  assertOrderItem,
  lockSalesOrder,
  shippedQuantitiesByItem,
} from "./shared";
import { canCreateShipmentForOrder, remainingOrderQuantity, type SalesOrderStatus } from "./status";
import { recalculateSalesOrderFulfillmentStatus } from "./fulfillment";

export type AllocationResult = {
  transactionId: string;
  transactionNumber: string;
  orderStatus: SalesOrderStatus;
};

export async function createAllocation(
  salesOrderId: string,
  input: CreateAllocationInput,
  actorUserId: string,
): Promise<AllocationResult> {
  return db.transaction(async (tx) => {
    const order = await lockSalesOrder(tx, salesOrderId);
    if (!canCreateShipmentForOrder(order.status)) {
      throw ApiError.conflict(
        `Alokasi hanya untuk pesanan aktif; status saat ini ${SO_STATUS_LABELS[order.status]}.`,
      );
    }

    const item = await assertOrderItem(tx, order.id, input.salesOrderItemId);
    const location = await assertLocationActive(tx, input.locationId);

    const [shippedMap, allocations] = await Promise.all([
      shippedQuantitiesByItem(tx, [item.id]),
      allocationRowsByItem(tx, [item.id]),
    ]);
    const shipped = shippedMap.get(item.id) ?? 0;
    const allocatedTotal = allocations.reduce((sum, row) => sum + row.quantity, 0);
    const remaining = remainingOrderQuantity(item.quantity, shipped);
    const unallocated = Math.max(0, remaining - allocatedTotal);
    if (input.quantity > unallocated) {
      throw ApiError.conflict(
        unallocated === 0
          ? `Item ${item.variantSku} sudah dialokasikan penuh.`
          : `Sisa yang perlu dialokasikan untuk ${item.variantSku} hanya ${unallocated} unit.`,
      );
    }

    const result = await postMovement(tx, {
      itemType: "FINISHED_GOOD",
      variantId: item.variantId,
      transactionType: "RESERVE",
      quantity: input.quantity,
      fromLocationId: input.locationId,
      referenceType: "so-allocation",
      referenceId: item.id,
      notes: `Alokasi barang jadi untuk ${order.number}`,
      idempotencyKey: input.idempotencyKey ? `so-allocation:${input.idempotencyKey}` : null,
      postedBy: actorUserId,
    });

    const updated = await recalculateSalesOrderFulfillmentStatus(tx, order.id);

    await recordAudit(tx, {
      actorUserId,
      action: "sales-order.allocate",
      entityType: "sales-order",
      entityId: order.id,
      details: {
        number: order.number,
        salesOrderItemId: item.id,
        item: item.label,
        location: `${location.warehouseName} / ${location.code}`,
        quantity: input.quantity,
        transactionNumber: result.transaction.number,
      },
    });

    return {
      transactionId: result.transaction.id,
      transactionNumber: result.transaction.number,
      orderStatus: updated.status,
    };
  });
}

export async function releaseAllocation(
  salesOrderId: string,
  input: ReleaseAllocationInput,
  actorUserId: string,
): Promise<AllocationResult> {
  return db.transaction(async (tx) => {
    const order = await lockSalesOrder(tx, salesOrderId);
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Pesanan yang dibatalkan tidak memiliki alokasi aktif.");
    }

    const item = await assertOrderItem(tx, order.id, input.salesOrderItemId);
    const allocations = await allocationRowsByItem(tx, [item.id]);
    const allocatedAtLocation = allocations
      .filter((row) => row.locationId === input.locationId)
      .reduce((sum, row) => sum + row.quantity, 0);
    if (input.quantity > allocatedAtLocation) {
      throw ApiError.conflict(
        `Hanya ${allocatedAtLocation} unit yang dialokasikan di lokasi ini.`,
      );
    }

    const result = await postMovement(tx, {
      itemType: "FINISHED_GOOD",
      variantId: item.variantId,
      transactionType: "UNRESERVE",
      quantity: input.quantity,
      fromLocationId: input.locationId,
      referenceType: "so-allocation",
      referenceId: item.id,
      notes: `Pelepasan alokasi ${order.number}${input.reason ? ` — ${input.reason}` : ""}`,
      postedBy: actorUserId,
    });

    const updated = await recalculateSalesOrderFulfillmentStatus(tx, order.id);

    await recordAudit(tx, {
      actorUserId,
      action: "sales-order.release-allocation",
      entityType: "sales-order",
      entityId: order.id,
      details: {
        number: order.number,
        salesOrderItemId: item.id,
        item: item.label,
        quantity: input.quantity,
        reason: input.reason ?? null,
        transactionNumber: result.transaction.number,
      },
    });

    return {
      transactionId: result.transaction.id,
      transactionNumber: result.transaction.number,
      orderStatus: updated.status,
    };
  });
}

/**
 * Lepas seluruh alokasi aktif pesanan (dipakai saat sales order dibatalkan)
 * agar stok tidak tertahan. Mengembalikan jumlah unit yang dilepas.
 */
export async function releaseAllOrderAllocations(
  tx: DbTransaction,
  salesOrderId: string,
  actorUserId: string,
  reason: string,
): Promise<number> {
  const items = await tx
    .select({ id: salesOrderItems.id, variantId: salesOrderItems.variantId })
    .from(salesOrderItems)
    .where(eq(salesOrderItems.salesOrderId, salesOrderId));
  if (items.length === 0) return 0;

  const allocations = await allocationRowsByItem(
    tx,
    items.map((item) => item.id),
  );
  if (allocations.length === 0) return 0;

  const variantByItem = new Map(items.map((item) => [item.id, item.variantId]));
  let released = 0;
  for (const allocation of allocations) {
    const variantId = variantByItem.get(allocation.itemId);
    if (!variantId) continue;
    await postMovement(tx, {
      itemType: "FINISHED_GOOD",
      variantId,
      transactionType: "UNRESERVE",
      quantity: allocation.quantity,
      fromLocationId: allocation.locationId,
      referenceType: "so-allocation",
      referenceId: allocation.itemId,
      notes: `Pelepasan alokasi — ${reason}`,
      idempotencyKey: `so-cancel:${allocation.itemId}:${allocation.locationId}`,
      postedBy: actorUserId,
    });
    released += allocation.quantity;
  }
  return released;
}

/* ------------------------------------------------------------------ */
/* Mutasi: buat / posting / batal pengiriman                           */
/* ------------------------------------------------------------------ */

