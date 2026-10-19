import { and, asc, count, desc, eq, ilike, inArray, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import {
  buyers,
  productVariants,
  products,
  salesOrderItems,
  salesOrders,
  shipmentItems,
  shipments,
} from "@/lib/db/schema";
import { getDateOffset, getTodayDate } from "@/lib/utils/dates";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { releaseAllOrderAllocations } from "@/modules/shipping/service";
import type { CancelSalesOrderInput, ListSalesOrdersQuery, SalesOrderFormInput } from "./schemas";
import { FINAL_SO_STATUSES, type SalesOrderStatus } from "./status";

export type SalesOrder = typeof salesOrders.$inferSelect;

export type SalesOrderListRow = {
  id: string;
  number: string;
  buyerId: string;
  buyerName: string;
  orderDate: string;
  dueDate: string;
  status: SalesOrderStatus;
  createdAt: Date;
  itemCount: number;
  totalQuantity: number;
  totalValue: string;
};

export type SalesOrderItemRow = {
  id: string;
  variantId: string;
  variantSku: string;
  size: string;
  color: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: string;
  dueDate: string | null;
  notes: string | null;
};

export type SalesOrderDetail = {
  order: SalesOrder;
  buyer: { id: string; code: string; name: string; contactPerson: string | null; phone: string | null };
  items: SalesOrderItemRow[];
  /** Saldo agregat; `shippedQuantity` baru terisi setelah Fase 4/5 (pengiriman). */
  totals: { itemCount: number; totalQuantity: number; shippedQuantity: number; totalValue: string };
};

const orderColumns = {
  id: salesOrders.id,
  number: salesOrders.number,
  buyerId: salesOrders.buyerId,
  orderDate: salesOrders.orderDate,
  dueDate: salesOrders.dueDate,
  status: salesOrders.status,
  createdAt: salesOrders.createdAt,
  buyerName: buyers.name,
} as const;

export async function listSalesOrders(
  params: ListSalesOrdersQuery,
): Promise<{ items: SalesOrderListRow[]; total: number }> {
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(salesOrders.number, pattern), ilike(buyers.name, pattern)));
  }
  if (params.status !== "all") conditions.push(eq(salesOrders.status, params.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(salesOrders)
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .where(where);

  const rows = await db
    .select({
      ...orderColumns,
      itemCount: count(salesOrderItems.id),
      totalQuantity: sql<number>`coalesce(sum(${salesOrderItems.quantity}), 0)::int`,
      totalValue: sql<string>`coalesce(sum(${salesOrderItems.quantity} * ${salesOrderItems.unitPrice}), 0)`,
    })
    .from(salesOrders)
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .where(where)
    .groupBy(salesOrders.id, buyers.id)
    .orderBy(desc(salesOrders.createdAt), desc(salesOrders.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: rows.map((row) => ({
      ...row,
      itemCount: Number(row.itemCount),
      totalQuantity: Number(row.totalQuantity),
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

export async function getSalesOrderDetail(salesOrderId: string): Promise<SalesOrderDetail> {
  const [orderRow] = await db
    .select({
      order: salesOrders,
      buyer: {
        id: buyers.id,
        code: buyers.code,
        name: buyers.name,
        contactPerson: buyers.contactPerson,
        phone: buyers.phone,
      },
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
      size: productVariants.size,
      color: productVariants.color,
      productName: products.name,
      productSku: products.sku,
      quantity: salesOrderItems.quantity,
      unitPrice: salesOrderItems.unitPrice,
      dueDate: salesOrderItems.dueDate,
      notes: salesOrderItems.notes,
    })
    .from(salesOrderItems)
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(salesOrderItems.salesOrderId, salesOrderId))
    .orderBy(asc(products.name), asc(productVariants.size), asc(productVariants.color));

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items
    .reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0)
    .toFixed(2);

  const [shippedRow] =
    items.length > 0
      ? await db
          .select({ value: sql<string>`coalesce(sum(${shipmentItems.quantity}), 0)` })
          .from(shipmentItems)
          .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
          .where(
            and(
              inArray(
                shipmentItems.salesOrderItemId,
                items.map((item) => item.id),
              ),
              eq(shipments.status, "POSTED"),
            ),
          )
      : [];

  return {
    order: orderRow.order,
    buyer: orderRow.buyer,
    items,
    totals: {
      itemCount: items.length,
      totalQuantity,
      shippedQuantity: Number(shippedRow?.value ?? 0),
      totalValue,
    },
  };
}

async function getOrderRow(tx: DbTransaction, salesOrderId: string): Promise<SalesOrder> {
  const [order] = await tx
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, salesOrderId))
    .limit(1)
    .for("update");
  if (!order) throw ApiError.notFound("Sales order tidak ditemukan.");
  return order;
}

async function assertBuyerActive(
  tx: DbTransaction,
  buyerId: string,
): Promise<{ id: string; name: string }> {
  const [buyer] = await tx
    .select({ id: buyers.id, name: buyers.name, isActive: buyers.isActive })
    .from(buyers)
    .where(eq(buyers.id, buyerId))
    .limit(1);
  if (!buyer) throw ApiError.badRequest("Buyer tidak ditemukan.");
  if (!buyer.isActive) throw ApiError.badRequest(`Buyer ${buyer.name} sedang nonaktif.`);
  return buyer;
}

async function assertVariantsActive(tx: DbTransaction, variantIds: string[]): Promise<void> {
  const rows = await tx
    .select({
      id: productVariants.id,
      variantSku: productVariants.variantSku,
      isActive: productVariants.isActive,
      productName: products.name,
      productActive: products.isActive,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(productVariants.id, [...new Set(variantIds)]));

  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const variantId of variantIds) {
    const variant = byId.get(variantId);
    if (!variant) throw ApiError.badRequest("Ada varian yang tidak ditemukan.");
    if (!variant.isActive) {
      throw ApiError.badRequest(`Varian ${variant.variantSku} sedang nonaktif.`);
    }
    if (!variant.productActive) {
      throw ApiError.badRequest(`Produk ${variant.productName} sedang nonaktif.`);
    }
  }
}

function toItemRows(salesOrderId: string, input: SalesOrderFormInput) {
  return input.items.map((item) => ({
    salesOrderId,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    // Kosong = ikut tenggat pesanan (disalin saat simpan agar item punya acuan tetap).
    dueDate: item.dueDate?.trim() ? item.dueDate : input.dueDate,
    notes: nullable(item.notes),
  }));
}

export async function createSalesOrder(
  input: SalesOrderFormInput,
  actorUserId: string,
): Promise<SalesOrder> {
  return db.transaction(async (tx) => {
    const buyer = await assertBuyerActive(tx, input.buyerId);
    await assertVariantsActive(
      tx,
      input.items.map((item) => item.variantId),
    );

    const number = await nextDocumentNumber(tx, "SO");

    const [order] = await tx
      .insert(salesOrders)
      .values({
        number,
        buyerId: input.buyerId,
        orderDate: input.orderDate,
        dueDate: input.dueDate,
        status: "DRAFT",
        notes: nullable(input.notes),
        createdBy: actorUserId,
      })
      .returning();
    if (!order) throw ApiError.badRequest("Gagal membuat sales order.");

    await tx.insert(salesOrderItems).values(toItemRows(order.id, input));

    await recordAudit(tx, {
      actorUserId,
      action: "sales-order.create",
      entityType: "sales-order",
      entityId: order.id,
      details: {
        number,
        buyerId: buyer.id,
        buyerName: buyer.name,
        itemCount: input.items.length,
        totalQuantity: input.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
    return order;
  });
}

export async function updateSalesOrder(
  salesOrderId: string,
  input: SalesOrderFormInput,
  actorUserId: string,
): Promise<SalesOrder> {
  return db.transaction(async (tx) => {
    const order = await getOrderRow(tx, salesOrderId);
    if (order.status !== "DRAFT") {
      throw ApiError.conflict("Hanya sales order berstatus draf yang dapat diubah.");
    }
    // Fase 4/5: tolak juga bila sudah ada SPK/pengiriman atas pesanan ini.
    const buyer = await assertBuyerActive(tx, input.buyerId);
    await assertVariantsActive(
      tx,
      input.items.map((item) => item.variantId),
    );

    const [updated] = await tx
      .update(salesOrders)
      .set({
        buyerId: input.buyerId,
        orderDate: input.orderDate,
        dueDate: input.dueDate,
        notes: nullable(input.notes),
      })
      .where(eq(salesOrders.id, salesOrderId))
      .returning();
    if (!updated) throw ApiError.notFound("Sales order tidak ditemukan.");

    // Selama masih draf, item diganti utuh — belum ada alokasi produksi/pengiriman.
    await tx.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, salesOrderId));
    await tx.insert(salesOrderItems).values(toItemRows(salesOrderId, input));

    await recordAudit(tx, {
      actorUserId,
      action: "sales-order.update",
      entityType: "sales-order",
      entityId: salesOrderId,
      details: {
        number: order.number,
        buyerFrom: order.buyerId,
        buyerTo: buyer.id,
        itemCount: input.items.length,
        dueDateFrom: order.dueDate,
        dueDateTo: input.dueDate,
      },
    });
    return updated;
  });
}

export async function confirmSalesOrder(
  salesOrderId: string,
  actorUserId: string,
): Promise<SalesOrder> {
  return db.transaction(async (tx) => {
    const order = await getOrderRow(tx, salesOrderId);

    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Sales order yang dibatalkan tidak dapat dikonfirmasi.");
    }
    if (order.status !== "DRAFT") {
      throw ApiError.conflict("Sales order ini sudah dikonfirmasi.");
    }

    const [itemCount] = await tx
      .select({ value: count() })
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, salesOrderId));
    if (Number(itemCount?.value ?? 0) === 0) {
      throw ApiError.conflict("Sales order tanpa item tidak dapat dikonfirmasi.");
    }

    const [updated] = await tx
      .update(salesOrders)
      .set({ status: "CONFIRMED", confirmedAt: new Date() })
      .where(eq(salesOrders.id, salesOrderId))
      .returning();
    if (!updated) throw ApiError.notFound("Sales order tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "sales-order.confirm",
      entityType: "sales-order",
      entityId: salesOrderId,
      details: { number: order.number, fromStatus: order.status, toStatus: "CONFIRMED" },
    });
    return updated;
  });
}

export async function cancelSalesOrder(
  salesOrderId: string,
  input: CancelSalesOrderInput,
  actorUserId: string,
): Promise<SalesOrder> {
  return db.transaction(async (tx) => {
    const order = await getOrderRow(tx, salesOrderId);
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Sales order ini sudah dibatalkan.");
    }
    if (order.status !== "DRAFT" && order.status !== "CONFIRMED") {
      throw ApiError.conflict(
        "Sales order yang sudah masuk produksi atau pengiriman tidak dapat dibatalkan.",
      );
    }

    const [activeShipment] = await tx
      .select({ value: count() })
      .from(shipments)
      .where(and(eq(shipments.salesOrderId, salesOrderId), ne(shipments.status, "CANCELLED")));
    if (Number(activeShipment?.value ?? 0) > 0) {
      throw ApiError.conflict(
        "Batalkan pengiriman draf terlebih dahulu sebelum membatalkan pesanan.",
      );
    }

    // Stok yang sudah dialokasikan dikembalikan agar tidak tertahan.
    const releasedQuantity = await releaseAllOrderAllocations(
      tx,
      salesOrderId,
      actorUserId,
      `pembatalan ${order.number}`,
    );

    const [updated] = await tx
      .update(salesOrders)
      .set({ status: "CANCELLED", cancelReason: input.reason, cancelledAt: new Date() })
      .where(eq(salesOrders.id, salesOrderId))
      .returning();
    if (!updated) throw ApiError.notFound("Sales order tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "sales-order.cancel",
      entityType: "sales-order",
      entityId: salesOrderId,
      details: {
        number: order.number,
        reason: input.reason,
        fromStatus: order.status,
        releasedAllocationQuantity: releasedQuantity,
      },
    });
    return updated;
  });
}

export type DashboardSoSummary = {
  activeCount: number;
  draftCount: number;
  dueSoonCount: number;
  overdueCount: number;
  /** Lima pesanan aktif dengan tenggat terdekat (termasuk yang sudah lewat). */
  dueSoon: {
    id: string;
    number: string;
    buyerName: string;
    dueDate: string;
    status: SalesOrderStatus;
    totalQuantity: number;
  }[];
};

/** Ringkasan SO untuk kartu dashboard (F2 task 2.9). */
export async function getDashboardSoSummary(): Promise<DashboardSoSummary> {
  const today = getTodayDate();
  const horizon = getDateOffset(7);
  const activeCondition = notInArray(salesOrders.status, [...FINAL_SO_STATUSES]);

  const [counts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${notInArray(salesOrders.status, [...FINAL_SO_STATUSES])})::int`,
      draft: sql<number>`count(*) filter (where ${eq(salesOrders.status, "DRAFT")})::int`,
      dueSoon: sql<number>`count(*) filter (where ${and(activeCondition, lte(salesOrders.dueDate, horizon))})::int`,
      overdue: sql<number>`count(*) filter (where ${and(activeCondition, lt(salesOrders.dueDate, today))})::int`,
    })
    .from(salesOrders);

  const dueSoonRows = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      buyerName: buyers.name,
      dueDate: salesOrders.dueDate,
      status: salesOrders.status,
      totalQuantity: sql<number>`coalesce(sum(${salesOrderItems.quantity}), 0)::int`,
    })
    .from(salesOrders)
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .where(and(activeCondition, lte(salesOrders.dueDate, horizon)))
    .groupBy(salesOrders.id, buyers.id)
    .orderBy(asc(salesOrders.dueDate), asc(salesOrders.number))
    .limit(5);

  return {
    activeCount: Number(counts?.active ?? 0),
    draftCount: Number(counts?.draft ?? 0),
    dueSoonCount: Number(counts?.dueSoon ?? 0),
    overdueCount: Number(counts?.overdue ?? 0),
    dueSoon: dueSoonRows.map((row) => ({ ...row, totalQuantity: Number(row.totalQuantity) })),
  };
}
