import { asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  productionOrders,
  productionStages,
  products,
  productVariants,
  qcInspections,
  salesOrderItems,
} from "@/lib/db/schema";
import { passedByProductionOrder } from "./shared";
import type {
  ProductionOrderStatus,
  ProductionStageCode,
  ProductionStageStatus,
} from "./status";

export type DashboardProductionSummary = {
  activeCount: number;
  completedThisMonthCount: number;
  pendingQcCount: number;
  reworkCount: number;
  nearest: {
    id: string;
    number: string;
    productName: string;
    variantSku: string;
    status: ProductionOrderStatus;
    plannedQuantity: number;
    outputQuantity: number;
    plannedEndDate: string;
  }[];
};

export async function getDashboardProductionSummary(): Promise<DashboardProductionSummary> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [spkRow] = await db
    .select({
      active: sql<number>`count(*) filter (where ${productionOrders.status} in ('OPEN', 'IN_PROGRESS'))::int`,
      completedThisMonth: sql<number>`count(*) filter (where ${productionOrders.status} = 'COMPLETED' and ${gte(productionOrders.completedAt, monthStart)})::int`,
    })
    .from(productionOrders);

  const [qcRow] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${qcInspections.result} = 'PENDING')::int`,
      rework: sql<number>`count(*) filter (where ${qcInspections.result} = 'REWORK')::int`,
    })
    .from(qcInspections);

  const nearestRows = await db
    .select({
      id: productionOrders.id,
      number: productionOrders.number,
      productName: products.name,
      variantSku: productVariants.variantSku,
      status: productionOrders.status,
      plannedQuantity: productionOrders.plannedQuantity,
      plannedEndDate: productionOrders.plannedEndDate,
    })
    .from(productionOrders)
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(productionOrders.status, ["OPEN", "IN_PROGRESS"]))
    .orderBy(asc(productionOrders.plannedEndDate))
    .limit(5);

  const passedMap = await passedByProductionOrder(
    db,
    nearestRows.map((row) => row.id),
  );

  return {
    activeCount: Number(spkRow?.active ?? 0),
    completedThisMonthCount: Number(spkRow?.completedThisMonth ?? 0),
    pendingQcCount: Number(qcRow?.pending ?? 0),
    reworkCount: Number(qcRow?.rework ?? 0),
    nearest: nearestRows.map((row) => ({
      ...row,
      plannedQuantity: Number(row.plannedQuantity),
      outputQuantity: passedMap.get(row.id) ?? 0,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Query baca: tahap yang dapat diinspeksi QC                          */
/* ------------------------------------------------------------------ */

export type InspectableStageOption = {
  stageId: string;
  stageCode: ProductionStageCode;
  status: ProductionStageStatus;
  targetQuantity: number;
  productionOrderId: string;
  productionOrderNumber: string;
  productName: string;
  variantSku: string;
  /** Sisa yang masih dapat diperiksa (inspeksi pertama). */
  inspectableQuantity: number;
};

/** Tahap dari SPK non-batal + sisa yang masih dapat diperiksa QC. */
export async function listInspectableStages(): Promise<InspectableStageOption[]> {
  const rows = await db
    .select({
      stageId: productionStages.id,
      stageCode: productionStages.stageCode,
      stageStatus: productionStages.status,
      targetQuantity: productionStages.targetQuantity,
      productionOrderId: productionOrders.id,
      productionOrderNumber: productionOrders.number,
      productName: products.name,
      variantSku: productVariants.variantSku,
      passed: sql<number>`coalesce((
        select sum(pr.passed_quantity) from production_records pr
        where pr.production_stage_id = ${productionStages.id}
      ), 0)::int`,
      inspected: sql<number>`coalesce((
        select sum(qi.inspected_quantity) from qc_inspections qi
        where qi.production_stage_id = ${productionStages.id} and qi.parent_inspection_id is null
      ), 0)::int`,
    })
    .from(productionStages)
    .innerJoin(productionOrders, eq(productionStages.productionOrderId, productionOrders.id))
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(sql`${productionOrders.status} <> 'CANCELLED'`)
    .orderBy(asc(productionOrders.plannedEndDate), asc(productionStages.sequenceNumber));

  return rows
    .map((row) => ({
      stageId: row.stageId,
      stageCode: row.stageCode,
      status: row.stageStatus,
      targetQuantity: Number(row.targetQuantity),
      productionOrderId: row.productionOrderId,
      productionOrderNumber: row.productionOrderNumber,
      productName: row.productName,
      variantSku: row.variantSku,
      inspectableQuantity: Math.max(0, Number(row.passed) - Number(row.inspected)),
    }))
    .filter((row) => row.inspectableQuantity > 0);
}
