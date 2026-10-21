import { and, count, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { type DbExecutor, type DbTransaction } from "@/lib/db";
import {
  inventoryBalances,
  inventoryTransactions,
  productVariants,
  productionOrders,
  products,
  salesOrderItems,
  salesOrders,
  shipmentItems,
  shipments,
  warehouseLocations,
  warehouses,
  type SalesOrder,
} from "@/lib/db/schema";

export async function lockSalesOrder(tx: DbTransaction, salesOrderId: string): Promise<SalesOrder> {
  const [order] = await tx
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, salesOrderId))
    .limit(1)
    .for("update");
  if (!order) throw ApiError.notFound("Sales order tidak ditemukan.");
  return order;
}

export async function shippedQuantitiesByItem(
  executor: DbExecutor,
  itemIds: string[],
): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await executor
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

type AllocationRow = {
  itemId: string;
  locationId: string;
  quantity: number;
};

/** Alokasi aktif per (item pesanan, lokasi) — RESERVE − UNRESERVE. */
export async function allocationRowsByItem(
  executor: DbExecutor,
  itemIds: string[],
): Promise<AllocationRow[]> {
  if (itemIds.length === 0) return [];
  const rows = await executor
    .select({
      itemId: inventoryTransactions.referenceId,
      locationId: inventoryTransactions.fromLocationId,
      value: sql<string>`coalesce(sum(case when ${inventoryTransactions.transactionType} = 'RESERVE' then ${inventoryTransactions.quantity} else -${inventoryTransactions.quantity} end), 0)`,
    })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.referenceType, "so-allocation"),
        inArray(inventoryTransactions.referenceId, itemIds),
      ),
    )
    .groupBy(inventoryTransactions.referenceId, inventoryTransactions.fromLocationId);

  return rows
    .filter(
      (row): row is { itemId: string; locationId: string; value: string } =>
        row.itemId !== null && row.locationId !== null && Number(row.value) > 0,
    )
    .map((row) => ({
      itemId: row.itemId,
      locationId: row.locationId,
      quantity: Number(row.value),
    }));
}

type FinishedGoodsBalanceRow = {
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
};

export async function finishedGoodsBalances(
  executor: DbExecutor,
  variantIds: string[],
): Promise<FinishedGoodsBalanceRow[]> {
  if (variantIds.length === 0) return [];
  const rows = await executor
    .select({
      variantId: inventoryBalances.variantId,
      locationId: inventoryBalances.locationId,
      onHand: inventoryBalances.quantityOnHand,
      reserved: inventoryBalances.quantityReserved,
    })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.itemType, "FINISHED_GOOD"),
        inArray(inventoryBalances.variantId, variantIds),
      ),
    );
  return rows
    .filter((row): row is typeof row & { variantId: string } => row.variantId !== null)
    .map((row) => ({
      variantId: row.variantId,
      locationId: row.locationId,
      onHand: Number(row.onHand),
      reserved: Number(row.reserved),
    }));
}

type LocationInfo = { code: string; name: string; warehouseName: string };

export async function locationInfoById(
  executor: DbExecutor,
  locationIds: string[],
): Promise<Map<string, LocationInfo>> {
  if (locationIds.length === 0) return new Map();
  const rows = await executor
    .select({
      id: warehouseLocations.id,
      code: warehouseLocations.code,
      name: warehouseLocations.name,
      warehouseName: warehouses.name,
    })
    .from(warehouseLocations)
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .where(inArray(warehouseLocations.id, locationIds));
  return new Map(
    rows.map((row) => [row.id, { code: row.code, name: row.name, warehouseName: row.warehouseName }]),
  );
}

export async function hasProductionOrder(executor: DbExecutor, itemIds: string[]): Promise<boolean> {
  if (itemIds.length === 0) return false;
  const [row] = await executor
    .select({ value: count() })
    .from(productionOrders)
    .where(
      and(
        inArray(productionOrders.salesOrderItemId, itemIds),
        sql`${productionOrders.status} <> 'CANCELLED'`,
      ),
    );
  return Number(row?.value ?? 0) > 0;
}

export async function assertOrderItem(
  tx: DbTransaction,
  salesOrderId: string,
  salesOrderItemId: string,
): Promise<{ id: string; variantId: string; quantity: number; variantSku: string; label: string }> {
  const [row] = await tx
    .select({
      id: salesOrderItems.id,
      variantId: salesOrderItems.variantId,
      quantity: salesOrderItems.quantity,
      variantSku: productVariants.variantSku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
    })
    .from(salesOrderItems)
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(eq(salesOrderItems.id, salesOrderItemId), eq(salesOrderItems.salesOrderId, salesOrderId)),
    )
    .limit(1);
  if (!row) throw ApiError.badRequest("Item pesanan tidak ditemukan pada sales order ini.");
  return {
    id: row.id,
    variantId: row.variantId,
    quantity: row.quantity,
    variantSku: row.variantSku,
    label: `${row.productName} — ${row.size}/${row.color} (${row.variantSku})`,
  };
}

export async function assertLocationActive(
  tx: DbTransaction,
  locationId: string,
): Promise<LocationInfo> {
  const [row] = await tx
    .select({
      code: warehouseLocations.code,
      name: warehouseLocations.name,
      warehouseName: warehouses.name,
      locationActive: warehouseLocations.isActive,
      warehouseActive: warehouses.isActive,
    })
    .from(warehouseLocations)
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .where(eq(warehouseLocations.id, locationId))
    .limit(1);
  if (!row) throw ApiError.badRequest("Lokasi gudang tidak ditemukan.");
  if (!row.locationActive || !row.warehouseActive) {
    throw ApiError.badRequest(`Lokasi ${row.code} sedang nonaktif.`);
  }
  return { code: row.code, name: row.name, warehouseName: row.warehouseName };
}

