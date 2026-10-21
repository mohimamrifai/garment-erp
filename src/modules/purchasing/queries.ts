import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { db, type DbExecutor } from "@/lib/db";
import {
  inventoryTransactions,
  materialReceiptItems,
  materialReceipts,
  materials,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  unitsOfMeasure,
  user,
  warehouseLocations,
  warehouses,
} from "@/lib/db/schema";
import type { ListMaterialReceiptsQuery, ListPurchaseOrdersQuery } from "./schemas";
import {
  loadPurchaseOrderItemsProgress,
  toScaled,
  type MaterialReceipt,
  type PurchaseOrder,
  type PurchaseOrderItemRow,
} from "./shared";
import { OPEN_PO_STATUSES, type MaterialReceiptStatus, type PurchaseOrderStatus } from "./status";

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

