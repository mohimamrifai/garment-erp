import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import {
  buyers,
  productVariants,
  products,
  salesOrderItems,
  salesOrders,
  shipmentItems,
  shipments,
  user,
  warehouseLocations,
  warehouses,
  type Shipment,
} from "@/lib/db/schema";
import type { ListShipmentsQuery } from "./schemas";
import {
  allocationRowsByItem,
  finishedGoodsBalances,
  locationInfoById,
  shippedQuantitiesByItem,
} from "./shared";
import {
  canCreateShipmentForOrder,
  isFullyAllocated,
  remainingOrderQuantity,
  SHIPPABLE_SO_STATUSES,
  type SalesOrderStatus,
  type ShipmentStatus,
} from "./status";

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
