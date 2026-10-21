import { eq } from "drizzle-orm";
import { type DbTransaction } from "@/lib/db";
import { salesOrderItems, salesOrders, type SalesOrder } from "@/lib/db/schema";
import {
  allocationRowsByItem,
  hasProductionOrder,
  lockSalesOrder,
  shippedQuantitiesByItem,
} from "./shared";
import { computeFulfillmentStatus } from "./status";

export async function recalculateSalesOrderFulfillmentStatus(
  tx: DbTransaction,
  salesOrderId: string,
): Promise<SalesOrder> {
  const order = await lockSalesOrder(tx, salesOrderId);
  if (order.status === "DRAFT" || order.status === "CANCELLED") return order;

  const items = await tx
    .select({ id: salesOrderItems.id, quantity: salesOrderItems.quantity })
    .from(salesOrderItems)
    .where(eq(salesOrderItems.salesOrderId, salesOrderId));
  if (items.length === 0) return order;

  const itemIds = items.map((item) => item.id);
  const [shippedMap, allocations, produced] = await Promise.all([
    shippedQuantitiesByItem(tx, itemIds),
    allocationRowsByItem(tx, itemIds),
    hasProductionOrder(tx, itemIds),
  ]);

  const allocatedByItem = new Map<string, number>();
  for (const allocation of allocations) {
    allocatedByItem.set(
      allocation.itemId,
      (allocatedByItem.get(allocation.itemId) ?? 0) + allocation.quantity,
    );
  }

  const status = computeFulfillmentStatus({
    items: items.map((item) => ({
      orderedQuantity: item.quantity,
      shippedQuantity: shippedMap.get(item.id) ?? 0,
      allocatedQuantity: allocatedByItem.get(item.id) ?? 0,
    })),
    currentStatus: order.status,
    hasProductionOrder: produced,
  });
  if (!status || status === order.status) return order;

  const [updated] = await tx
    .update(salesOrders)
    .set({ status })
    .where(eq(salesOrders.id, salesOrderId))
    .returning();
  return updated ?? order;
}

/* ------------------------------------------------------------------ */
/* Alokasi barang jadi ke item pesanan                                 */
/* ------------------------------------------------------------------ */

