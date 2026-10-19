import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor, type DbTransaction } from "@/lib/db";
import {
  buyers,
  inventoryBalances,
  inventoryTransactions,
  productVariants,
  productionOrders,
  products,
  salesOrderItems,
  salesOrders,
  shipmentItems,
  shipments,
  user,
  warehouseLocations,
  warehouses,
  type SalesOrder,
  type Shipment,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { postMovement } from "@/modules/inventory/engine";
import { SO_STATUS_LABELS } from "@/modules/sales-order/status";
import {
  canCancelShipment,
  canCreateShipmentForOrder,
  computeFulfillmentStatus,
  isFullyAllocated,
  maxShippableQuantity,
  remainingOrderQuantity,
  SHIPPABLE_SO_STATUSES,
  type SalesOrderStatus,
  type ShipmentStatus,
} from "./status";
import type {
  CancelShipmentInput,
  CreateAllocationInput,
  CreateShipmentInput,
  ListShipmentsQuery,
  ReleaseAllocationInput,
} from "./schemas";

/**
 * Service pengiriman & pemenuhan pesanan (PRD FR-10, F5 task 5.3–5.4).
 *
 * Aturan:
 * - Alokasi = RESERVE di inventory engine dengan `reference_type =
 *   'so-allocation'` + `reference_id = sales_order_items.id`; pelepasan =
 *   UNRESERVE dengan referensi yang sama sehingga buku alokasi konsisten.
 * - Pengiriman draf → diposting: UNRESERVE alokasi item (bila ada) lalu ISSUE
 *   barang jadi, semuanya dalam satu transaksi DB. Kunci idempotensi per baris
 *   (`shipment:<id>:...`) mencegah penggandaan bila request diulang.
 * - Kuantitas kirim ≤ sisa pesanan (dipesan − terkirim) dan ≤ barang jadi yang
 *   tersedia di lokasi (tersedia + alokasi milik item tersebut).
 * - Status SO diturunkan dari pemenuhan: Selesai / Terkirim Sebagian / Siap
 *   Kirim (semua sisa sudah dialokasikan).
 */

export type { ShipmentStatus };

/* ------------------------------------------------------------------ */
/* Query baca: daftar & detail pengiriman                              */
/* ------------------------------------------------------------------ */

export type ShipmentListRow = {
  id: string;
  number: string;
  salesOrderId: string;
  salesOrderNumber: string;
  buyerName: string;
  shippedAt: string;
  status: ShipmentStatus;
  itemCount: number;
  totalQuantity: number;
  postedAt: Date | null;
};

export async function listShipments(
  params: ListShipmentsQuery,
): Promise<{ items: ShipmentListRow[]; total: number }> {
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(shipments.number, pattern),
        ilike(salesOrders.number, pattern),
        ilike(buyers.name, pattern),
      )!,
    );
  }
  if (params.status !== "all") conditions.push(eq(shipments.status, params.status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: shipments.id,
      number: shipments.number,
      salesOrderId: shipments.salesOrderId,
      salesOrderNumber: salesOrders.number,
      buyerName: buyers.name,
      shippedAt: shipments.shippedAt,
      status: shipments.status,
      postedAt: shipments.postedAt,
      itemCount: sql<number>`count(${shipmentItems.id})::int`,
      totalQuantity: sql<string>`coalesce(sum(${shipmentItems.quantity}), 0)`,
      totalCount: sql<number>`count(*) over ()::int`,
    })
    .from(shipments)
    .innerJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .leftJoin(shipmentItems, eq(shipmentItems.shipmentId, shipments.id))
    .where(where)
    .groupBy(shipments.id, salesOrders.id, buyers.id)
    .orderBy(desc(shipments.shippedAt), desc(shipments.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: rows.map((row) => ({
      ...row,
      totalQuantity: Number(row.totalQuantity),
    })),
    total: rows[0]?.totalCount ?? 0,
  };
}

export type ShipmentDetailItem = {
  id: string;
  salesOrderItemId: string;
  variantId: string;
  variantSku: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  orderedQuantity: number;
  notes: string | null;
};

export type ShipmentDetail = {
  shipment: Shipment;
  order: {
    id: string;
    number: string;
    status: SalesOrderStatus;
    orderDate: string;
    dueDate: string;
  };
  buyer: { id: string; name: string };
  location: { id: string; code: string; name: string; warehouseName: string };
  items: ShipmentDetailItem[];
  totals: { itemCount: number; totalQuantity: number };
  createdByName: string | null;
  postedByName: string | null;
};

const createdUser = alias(user, "shipment_created_user");
const postedUser = alias(user, "shipment_posted_user");

export async function getShipmentDetail(shipmentId: string): Promise<ShipmentDetail> {
  const [row] = await db
    .select({
      shipment: shipments,
      order: {
        id: salesOrders.id,
        number: salesOrders.number,
        status: salesOrders.status,
        orderDate: salesOrders.orderDate,
        dueDate: salesOrders.dueDate,
      },
      buyer: { id: buyers.id, name: buyers.name },
      location: {
        id: warehouseLocations.id,
        code: warehouseLocations.code,
        name: warehouseLocations.name,
        warehouseName: warehouses.name,
      },
      createdByName: createdUser.name,
      postedByName: postedUser.name,
    })
    .from(shipments)
    .innerJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .innerJoin(warehouseLocations, eq(shipments.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .leftJoin(createdUser, eq(shipments.createdBy, createdUser.id))
    .leftJoin(postedUser, eq(shipments.postedBy, postedUser.id))
    .where(eq(shipments.id, shipmentId))
    .limit(1);

  if (!row) throw ApiError.notFound("Pengiriman tidak ditemukan.");

  const items = await db
    .select({
      id: shipmentItems.id,
      salesOrderItemId: shipmentItems.salesOrderItemId,
      variantId: shipmentItems.variantId,
      variantSku: productVariants.variantSku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      quantity: shipmentItems.quantity,
      orderedQuantity: salesOrderItems.quantity,
      notes: shipmentItems.notes,
    })
    .from(shipmentItems)
    .innerJoin(salesOrderItems, eq(shipmentItems.salesOrderItemId, salesOrderItems.id))
    .innerJoin(productVariants, eq(shipmentItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(shipmentItems.shipmentId, shipmentId))
    .orderBy(asc(products.name), asc(productVariants.size), asc(productVariants.color));

  return {
    ...row,
    items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
    totals: {
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity), 0),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Query baca: pemenuhan pesanan                                       */
/* ------------------------------------------------------------------ */

export type OrderFulfillmentLocation = {
  locationId: string;
  locationCode: string;
  locationName: string;
  warehouseName: string;
  /** Barang jadi tersedia di lokasi (on hand − reserved). */
  availableQuantity: number;
  /** Alokasi milik item ini di lokasi. */
  allocatedQuantity: number;
};

export type OrderFulfillmentItem = {
  salesOrderItemId: string;
  variantId: string;
  variantSku: string;
  productName: string;
  size: string;
  color: string;
  orderedQuantity: number;
  shippedQuantity: number;
  allocatedQuantity: number;
  /** Barang jadi tersedia total (semua lokasi). */
  availableQuantity: number;
  remainingQuantity: number;
  unallocatedQuantity: number;
  locations: OrderFulfillmentLocation[];
};

export type OrderShipmentRow = {
  id: string;
  number: string;
  shippedAt: string;
  status: ShipmentStatus;
  totalQuantity: number;
};

export type OrderFulfillment = {
  order: {
    id: string;
    number: string;
    status: SalesOrderStatus;
    orderDate: string;
    dueDate: string;
    buyerName: string;
  };
  items: OrderFulfillmentItem[];
  shipments: OrderShipmentRow[];
  totals: {
    orderedQuantity: number;
    shippedQuantity: number;
    allocatedQuantity: number;
    remainingQuantity: number;
    unallocatedQuantity: number;
  };
  isFullyAllocated: boolean;
  canAllocate: boolean;
  canShip: boolean;
};

async function lockSalesOrder(tx: DbTransaction, salesOrderId: string): Promise<SalesOrder> {
  const [order] = await tx
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, salesOrderId))
    .limit(1)
    .for("update");
  if (!order) throw ApiError.notFound("Sales order tidak ditemukan.");
  return order;
}

async function shippedQuantitiesByItem(
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
async function allocationRowsByItem(
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

async function finishedGoodsBalances(
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

async function locationInfoById(
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

async function hasProductionOrder(executor: DbExecutor, itemIds: string[]): Promise<boolean> {
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

export async function getSalesOrderFulfillment(
  salesOrderId: string,
): Promise<OrderFulfillment> {
  const [orderRow] = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      status: salesOrders.status,
      orderDate: salesOrders.orderDate,
      dueDate: salesOrders.dueDate,
      buyerName: buyers.name,
    })
    .from(salesOrders)
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .where(eq(salesOrders.id, salesOrderId))
    .limit(1);
  if (!orderRow) throw ApiError.notFound("Sales order tidak ditemukan.");

  const items = await db
    .select({
      id: salesOrderItems.id,
      variantId: salesOrderItems.variantId,
      variantSku: productVariants.variantSku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      orderedQuantity: salesOrderItems.quantity,
    })
    .from(salesOrderItems)
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(salesOrderItems.salesOrderId, salesOrderId))
    .orderBy(asc(products.name), asc(productVariants.size), asc(productVariants.color));

  const itemIds = items.map((item) => item.id);
  const variantIds = [...new Set(items.map((item) => item.variantId))];

  const [shippedMap, allocations, balances, shipmentsRows] = await Promise.all([
    shippedQuantitiesByItem(db, itemIds),
    allocationRowsByItem(db, itemIds),
    finishedGoodsBalances(db, variantIds),
    db
      .select({
        id: shipments.id,
        number: shipments.number,
        shippedAt: shipments.shippedAt,
        status: shipments.status,
        totalQuantity: sql<string>`coalesce(sum(${shipmentItems.quantity}), 0)`,
      })
      .from(shipments)
      .leftJoin(shipmentItems, eq(shipmentItems.shipmentId, shipments.id))
      .where(eq(shipments.salesOrderId, salesOrderId))
      .groupBy(shipments.id)
      .orderBy(desc(shipments.shippedAt), desc(shipments.number)),
  ]);

  const locationIds = [
    ...new Set([
      ...allocations.map((row) => row.locationId),
      ...balances.filter((row) => row.onHand > 0 || row.reserved > 0).map((row) => row.locationId),
    ]),
  ];
  const locationInfo = await locationInfoById(db, locationIds);

  const fulfillmentItems: OrderFulfillmentItem[] = items.map((item) => {
    const shippedQuantity = shippedMap.get(item.id) ?? 0;
    const itemAllocations = allocations.filter((row) => row.itemId === item.id);
    const allocatedQuantity = itemAllocations.reduce((sum, row) => sum + row.quantity, 0);
    const itemBalances = balances.filter((row) => row.variantId === item.variantId);
    const availableQuantity = itemBalances.reduce(
      (sum, row) => sum + (row.onHand - row.reserved),
      0,
    );

    const locationMap = new Map<string, OrderFulfillmentLocation>();
    for (const balance of itemBalances) {
      if (balance.onHand <= 0 && balance.reserved <= 0) continue;
      const info = locationInfo.get(balance.locationId);
      if (!info) continue;
      locationMap.set(balance.locationId, {
        locationId: balance.locationId,
        locationCode: info.code,
        locationName: info.name,
        warehouseName: info.warehouseName,
        availableQuantity: balance.onHand - balance.reserved,
        allocatedQuantity: 0,
      });
    }
    for (const allocation of itemAllocations) {
      const info = locationInfo.get(allocation.locationId);
      if (!info) continue;
      const existing = locationMap.get(allocation.locationId);
      if (existing) {
        existing.allocatedQuantity = allocation.quantity;
      } else {
        locationMap.set(allocation.locationId, {
          locationId: allocation.locationId,
          locationCode: info.code,
          locationName: info.name,
          warehouseName: info.warehouseName,
          availableQuantity: 0,
          allocatedQuantity: allocation.quantity,
        });
      }
    }

    return {
      salesOrderItemId: item.id,
      variantId: item.variantId,
      variantSku: item.variantSku,
      productName: item.productName,
      size: item.size,
      color: item.color,
      orderedQuantity: item.orderedQuantity,
      shippedQuantity,
      allocatedQuantity,
      availableQuantity,
      remainingQuantity: remainingOrderQuantity(item.orderedQuantity, shippedQuantity),
      unallocatedQuantity: Math.max(
        0,
        remainingOrderQuantity(item.orderedQuantity, shippedQuantity) - allocatedQuantity,
      ),
      locations: [...locationMap.values()].sort((a, b) =>
        `${a.warehouseName}/${a.locationCode}`.localeCompare(
          `${b.warehouseName}/${b.locationCode}`,
        ),
      ),
    };
  });

  const canShip = canCreateShipmentForOrder(orderRow.status);
  const fullyAllocated = isFullyAllocated(
    fulfillmentItems.map((item) => ({
      orderedQuantity: item.orderedQuantity,
      shippedQuantity: item.shippedQuantity,
      allocatedQuantity: item.allocatedQuantity,
    })),
  );

  return {
    order: orderRow,
    items: fulfillmentItems,
    shipments: shipmentsRows.map((row) => ({
      ...row,
      totalQuantity: Number(row.totalQuantity),
    })),
    totals: {
      orderedQuantity: fulfillmentItems.reduce((sum, item) => sum + item.orderedQuantity, 0),
      shippedQuantity: fulfillmentItems.reduce((sum, item) => sum + item.shippedQuantity, 0),
      allocatedQuantity: fulfillmentItems.reduce((sum, item) => sum + item.allocatedQuantity, 0),
      remainingQuantity: fulfillmentItems.reduce((sum, item) => sum + item.remainingQuantity, 0),
      unallocatedQuantity: fulfillmentItems.reduce(
        (sum, item) => sum + item.unallocatedQuantity,
        0,
      ),
    },
    isFullyAllocated: fullyAllocated,
    canAllocate: canShip && fulfillmentItems.some((item) => item.unallocatedQuantity > 0),
    canShip: canShip && fulfillmentItems.some((item) => item.remainingQuantity > 0),
  };
}

export type ShippableOrderOption = {
  id: string;
  number: string;
  buyerName: string;
  dueDate: string;
  status: SalesOrderStatus;
  remainingQuantity: number;
  itemCount: number;
};

/** Pesanan aktif yang masih punya sisa kuantitas untuk dikirim. */
export async function listShippableSalesOrders(): Promise<ShippableOrderOption[]> {
  const orders = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      buyerName: buyers.name,
      dueDate: salesOrders.dueDate,
      status: salesOrders.status,
    })
    .from(salesOrders)
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .where(inArray(salesOrders.status, [...SHIPPABLE_SO_STATUSES]))
    .orderBy(asc(salesOrders.dueDate), asc(salesOrders.number));
  if (orders.length === 0) return [];

  const orderIds = orders.map((order) => order.id);
  const items = await db
    .select({
      id: salesOrderItems.id,
      salesOrderId: salesOrderItems.salesOrderId,
      quantity: salesOrderItems.quantity,
    })
    .from(salesOrderItems)
    .where(inArray(salesOrderItems.salesOrderId, orderIds));
  const shippedMap = await shippedQuantitiesByItem(
    db,
    items.map((item) => item.id),
  );

  const itemsByOrder = new Map<string, { quantity: number; shipped: number }[]>();
  for (const item of items) {
    const entry = itemsByOrder.get(item.salesOrderId) ?? [];
    entry.push({ quantity: item.quantity, shipped: shippedMap.get(item.id) ?? 0 });
    itemsByOrder.set(item.salesOrderId, entry);
  }

  return orders
    .map((order) => {
      const orderItems = itemsByOrder.get(order.id) ?? [];
      const remainingQuantity = orderItems.reduce(
        (sum, item) => sum + remainingOrderQuantity(item.quantity, item.shipped),
        0,
      );
      return { ...order, remainingQuantity, itemCount: orderItems.length };
    })
    .filter((order) => order.remainingQuantity > 0);
}

/* ------------------------------------------------------------------ */
/* Status pesanan turunan                                              */
/* ------------------------------------------------------------------ */

/**
 * Hitung ulang status SO dari pemenuhan (dipanggil setelah alokasi berubah
 * atau pengiriman diposting). Tidak menyentuh DRAFT/CANCELLED.
 */
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

async function assertOrderItem(
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

async function assertLocationActive(
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

export async function createShipment(
  input: CreateShipmentInput,
  actorUserId: string,
): Promise<Shipment> {
  return db.transaction(async (tx) => {
    const order = await lockSalesOrder(tx, input.salesOrderId);
    if (!canCreateShipmentForOrder(order.status)) {
      throw ApiError.conflict(
        `Sales order berstatus ${SO_STATUS_LABELS[order.status]} tidak dapat dikirim.`,
      );
    }
    const location = await assertLocationActive(tx, input.locationId);

    const orderItems = await tx
      .select({
        id: salesOrderItems.id,
        variantId: salesOrderItems.variantId,
        quantity: salesOrderItems.quantity,
        variantSku: productVariants.variantSku,
      })
      .from(salesOrderItems)
      .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
      .where(eq(salesOrderItems.salesOrderId, order.id));
    const itemById = new Map(orderItems.map((item) => [item.id, item]));

    const itemIds = input.items.map((item) => item.salesOrderItemId);
    const variantIds = [
      ...new Set(
        input.items
          .map((item) => itemById.get(item.salesOrderItemId)?.variantId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [shippedMap, allocations, balances] = await Promise.all([
      shippedQuantitiesByItem(tx, itemIds),
      allocationRowsByItem(tx, itemIds),
      finishedGoodsBalances(tx, variantIds),
    ]);

    for (const line of input.items) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw ApiError.badRequest("Kuantitas pengiriman minimal 1.");
      }
      const item = itemById.get(line.salesOrderItemId);
      if (!item) {
        throw ApiError.badRequest("Ada item pengiriman yang bukan milik sales order ini.");
      }
      const shipped = shippedMap.get(item.id) ?? 0;
      const allocatedAtLocation = allocations
        .filter((row) => row.itemId === item.id && row.locationId === input.locationId)
        .reduce((sum, row) => sum + row.quantity, 0);
      const balance = balances.find(
        (row) => row.variantId === item.variantId && row.locationId === input.locationId,
      );
      const availableAtLocation = balance ? balance.onHand - balance.reserved : 0;
      const max = maxShippableQuantity({
        orderedQuantity: item.quantity,
        shippedQuantity: shipped,
        availableAtLocation,
        allocatedToItemAtLocation: allocatedAtLocation,
      });
      if (line.quantity > max) {
        throw ApiError.conflict(
          `Kuantitas pengiriman ${item.variantSku} melebihi batas (maksimal ${max} unit: sisa pesanan ${remainingOrderQuantity(item.quantity, shipped)}, tersedia di ${location.code} ${availableAtLocation + allocatedAtLocation}).`,
        );
      }
    }

    const number = await nextDocumentNumber(tx, "SJ");
    const [shipment] = await tx
      .insert(shipments)
      .values({
        number,
        salesOrderId: order.id,
        shippedAt: input.shippedAt,
        locationId: input.locationId,
        status: "DRAFT",
        notes: nullable(input.notes),
        createdBy: actorUserId,
      })
      .returning();
    if (!shipment) throw ApiError.badRequest("Gagal membuat pengiriman.");

    await tx.insert(shipmentItems).values(
      input.items.map((line) => ({
        shipmentId: shipment.id,
        salesOrderItemId: line.salesOrderItemId,
        variantId: itemById.get(line.salesOrderItemId)!.variantId,
        quantity: String(line.quantity),
        notes: nullable(line.notes),
      })),
    );

    await recordAudit(tx, {
      actorUserId,
      action: "shipment.create",
      entityType: "shipment",
      entityId: shipment.id,
      details: {
        number,
        salesOrderNumber: order.number,
        location: `${location.warehouseName} / ${location.code}`,
        itemCount: input.items.length,
        totalQuantity: input.items.reduce((sum, line) => sum + line.quantity, 0),
      },
    });

    return shipment;
  });
}

export async function postShipment(
  shipmentId: string,
  actorUserId: string,
): Promise<Shipment> {
  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");
    if (!shipment) throw ApiError.notFound("Pengiriman tidak ditemukan.");
    if (shipment.status === "POSTED") {
      throw ApiError.conflict("Pengiriman ini sudah diposting.");
    }
    if (!canCancelShipment(shipment.status)) {
      throw ApiError.conflict("Pengiriman yang dibatalkan tidak dapat diposting.");
    }

    const order = await lockSalesOrder(tx, shipment.salesOrderId);
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Sales order sudah dibatalkan; pengiriman tidak dapat diposting.");
    }

    const lines = await tx
      .select({
        id: shipmentItems.id,
        salesOrderItemId: shipmentItems.salesOrderItemId,
        variantId: shipmentItems.variantId,
        quantity: shipmentItems.quantity,
        variantSku: productVariants.variantSku,
        orderedQuantity: salesOrderItems.quantity,
      })
      .from(shipmentItems)
      .innerJoin(salesOrderItems, eq(shipmentItems.salesOrderItemId, salesOrderItems.id))
      .innerJoin(productVariants, eq(shipmentItems.variantId, productVariants.id))
      .where(eq(shipmentItems.shipmentId, shipment.id));
    if (lines.length === 0) {
      throw ApiError.badRequest("Pengiriman tidak memiliki item.");
    }

    const itemIds = lines.map((line) => line.salesOrderItemId);
    const variantIds = [...new Set(lines.map((line) => line.variantId))];
    const [shippedMap, allocations, balances] = await Promise.all([
      shippedQuantitiesByItem(tx, itemIds),
      allocationRowsByItem(tx, itemIds),
      finishedGoodsBalances(tx, variantIds),
    ]);

    for (const line of lines) {
      const quantity = Number(line.quantity);
      const shipped = shippedMap.get(line.salesOrderItemId) ?? 0;
      const remaining = remainingOrderQuantity(line.orderedQuantity, shipped);
      if (quantity > remaining) {
        throw ApiError.conflict(
          `Sisa pesanan ${line.variantSku} hanya ${remaining} unit; tidak dapat mengirim ${quantity}.`,
        );
      }

      const allocatedAtLocation = allocations
        .filter(
          (row) => row.itemId === line.salesOrderItemId && row.locationId === shipment.locationId,
        )
        .reduce((sum, row) => sum + row.quantity, 0);
      const release = Math.min(quantity, allocatedAtLocation);
      const balance = balances.find(
        (row) => row.variantId === line.variantId && row.locationId === shipment.locationId,
      );
      const availableAtLocation = (balance ? balance.onHand - balance.reserved : 0) + release;
      if (quantity > availableAtLocation) {
        throw ApiError.conflict(
          `Stok barang jadi ${line.variantSku} di lokasi pengiriman tidak cukup (tersedia ${availableAtLocation} unit).`,
        );
      }

      if (release > 0) {
        await postMovement(tx, {
          itemType: "FINISHED_GOOD",
          variantId: line.variantId,
          transactionType: "UNRESERVE",
          quantity: release,
          fromLocationId: shipment.locationId,
          referenceType: "so-allocation",
          referenceId: line.salesOrderItemId,
          notes: `Pelepasan alokasi untuk pengiriman ${shipment.number}`,
          idempotencyKey: `shipment:${shipment.id}:unreserve:${line.id}`,
          postedBy: actorUserId,
        });
      }

      await postMovement(tx, {
        itemType: "FINISHED_GOOD",
        variantId: line.variantId,
        transactionType: "ISSUE",
        quantity,
        fromLocationId: shipment.locationId,
        referenceType: "shipment",
        referenceId: shipment.id,
        notes: `Pengiriman ${shipment.number} — ${order.number}`,
        idempotencyKey: `shipment:${shipment.id}:issue:${line.id}`,
        postedBy: actorUserId,
      });
    }

    const [updated] = await tx
      .update(shipments)
      .set({ status: "POSTED", postedAt: new Date(), postedBy: actorUserId })
      .where(eq(shipments.id, shipment.id))
      .returning();
    if (!updated) throw ApiError.badRequest("Gagal memposting pengiriman.");

    const recalculated = await recalculateSalesOrderFulfillmentStatus(tx, order.id);

    await recordAudit(tx, {
      actorUserId,
      action: "shipment.post",
      entityType: "shipment",
      entityId: shipment.id,
      details: {
        number: shipment.number,
        salesOrderNumber: order.number,
        itemCount: lines.length,
        totalQuantity: lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        orderStatus: recalculated.status,
      },
    });

    return updated;
  });
}

export async function cancelShipment(
  shipmentId: string,
  input: CancelShipmentInput,
  actorUserId: string,
): Promise<Shipment> {
  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");
    if (!shipment) throw ApiError.notFound("Pengiriman tidak ditemukan.");
    if (!canCancelShipment(shipment.status)) {
      throw ApiError.conflict("Hanya pengiriman berstatus draf yang dapat dibatalkan.");
    }

    const [updated] = await tx
      .update(shipments)
      .set({
        status: "CANCELLED",
        cancelReason: input.reason,
        cancelledAt: new Date(),
      })
      .where(eq(shipments.id, shipment.id))
      .returning();
    if (!updated) throw ApiError.badRequest("Gagal membatalkan pengiriman.");

    await recordAudit(tx, {
      actorUserId,
      action: "shipment.cancel",
      entityType: "shipment",
      entityId: shipment.id,
      details: { number: shipment.number, reason: input.reason },
    });

    return updated;
  });
}
