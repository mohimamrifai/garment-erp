import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { materialReceipts, purchaseOrders, suppliers } from "@/lib/db/schema";
import { getDateOffset, getTodayDate } from "@/lib/utils/dates";
import {
  loadPurchaseOrderItemsProgress,
  toScaled,
} from "./shared";
import { OPEN_PO_STATUSES, type PurchaseOrderStatus } from "./status";

export type DashboardPurchasingSummary = {
  openCount: number;
  draftCount: number;
  draftReceiptCount: number;
  dueSoonCount: number;
  overdueCount: number;
  nearest: {
    id: string;
    number: string;
    supplierName: string;
    expectedDate: string | null;
    status: PurchaseOrderStatus;
    remainingQuantity: string;
  }[];
};

export async function getDashboardPurchasingSummary(): Promise<DashboardPurchasingSummary> {
  const today = getTodayDate();
  const horizon = getDateOffset(7);
  const openCondition = inArray(purchaseOrders.status, OPEN_PO_STATUSES);

  const [counts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${openCondition})::int`,
      draft: sql<number>`count(*) filter (where ${eq(purchaseOrders.status, "DRAFT")})::int`,
      dueSoon: sql<number>`count(*) filter (where ${and(openCondition, lte(purchaseOrders.expectedDate, horizon))})::int`,
      overdue: sql<number>`count(*) filter (where ${and(openCondition, lt(purchaseOrders.expectedDate, today))})::int`,
    })
    .from(purchaseOrders);

  const [receiptCounts] = await db
    .select({
      draft: sql<number>`count(*) filter (where ${eq(materialReceipts.status, "DRAFT")})::int`,
    })
    .from(materialReceipts);

  const nearestRows = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      supplierName: suppliers.name,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(and(openCondition, lte(purchaseOrders.expectedDate, horizon)))
    .orderBy(asc(purchaseOrders.expectedDate), asc(purchaseOrders.number))
    .limit(5);

  const progress = await loadPurchaseOrderItemsProgress(
    db,
    nearestRows.map((row) => row.id),
  );
  const remainingByPo = new Map<string, number>();
  for (const item of progress) {
    const poId = item.purchaseOrderId;
    remainingByPo.set(poId, (remainingByPo.get(poId) ?? 0) + toScaled(Number(item.remainingQuantity)));
  }

  return {
    openCount: Number(counts?.open ?? 0),
    draftCount: Number(counts?.draft ?? 0),
    draftReceiptCount: Number(receiptCounts?.draft ?? 0),
    dueSoonCount: Number(counts?.dueSoon ?? 0),
    overdueCount: Number(counts?.overdue ?? 0),
    nearest: nearestRows.map((row) => ({
      ...row,
      remainingQuantity: ((remainingByPo.get(row.id) ?? 0) / 10_000).toFixed(4),
    })),
  };
}
