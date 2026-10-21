import { and, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { type DbExecutor, type DbTransaction } from "@/lib/db";
import {
  productionOrders,
  productionRecords,
  productionStages,
  qcInspections,
} from "@/lib/db/schema";

export type ProductionOrder = typeof productionOrders.$inferSelect;
export type ProductionStage = typeof productionStages.$inferSelect;
export type ProductionRecord = typeof productionRecords.$inferSelect;

export function toScaled(value: number): number {
  return Math.round(value * 10_000);
}
export async function passedByProductionOrder(
  executor: DbExecutor,
  productionOrderIds: string[],
): Promise<Map<string, number>> {
  if (productionOrderIds.length === 0) return new Map();
  const rows = await executor
    .select({
      productionOrderId: productionStages.productionOrderId,
      passed: sql<number>`coalesce(sum(${productionRecords.passedQuantity}), 0)::int`,
    })
    .from(productionRecords)
    .innerJoin(productionStages, eq(productionStages.id, productionRecords.productionStageId))
    .where(
      and(
        inArray(productionStages.productionOrderId, productionOrderIds),
        eq(productionStages.stageCode, "PACKING"),
      ),
    )
    .groupBy(productionStages.productionOrderId);
  return new Map(rows.map((row) => [row.productionOrderId, Number(row.passed)]));
}

type RecordAggregates = {
  processedNormal: number;
  processedRework: number;
  passedTotal: number;
  rejectedTotal: number;
};

export async function recordAggregates(executor: DbExecutor, stageId: string): Promise<RecordAggregates> {
  const [row] = await executor
    .select({
      processedNormal: sql<number>`coalesce(sum(${productionRecords.processedQuantity}) filter (where ${productionRecords.isRework} = false), 0)::int`,
      processedRework: sql<number>`coalesce(sum(${productionRecords.processedQuantity}) filter (where ${productionRecords.isRework} = true), 0)::int`,
      passedTotal: sql<number>`coalesce(sum(${productionRecords.passedQuantity}), 0)::int`,
      rejectedTotal: sql<number>`coalesce(sum(${productionRecords.rejectedQuantity}), 0)::int`,
    })
    .from(productionRecords)
    .where(eq(productionRecords.productionStageId, stageId));
  return {
    processedNormal: Number(row?.processedNormal ?? 0),
    processedRework: Number(row?.processedRework ?? 0),
    passedTotal: Number(row?.passedTotal ?? 0),
    rejectedTotal: Number(row?.rejectedTotal ?? 0),
  };
}

/** Total kuantitas ditolak inspeksi REWORK pada sebuah tahap (jatah rework). */
export async function reworkRejectedTotal(executor: DbExecutor, stageId: string): Promise<number> {
  const [row] = await executor
    .select({
      value: sql<number>`coalesce(sum(${qcInspections.rejectedQuantity}), 0)::int`,
    })
    .from(qcInspections)
    .where(and(eq(qcInspections.productionStageId, stageId), eq(qcInspections.result, "REWORK")));
  return Number(row?.value ?? 0);
}

export async function lockProductionOrder(
  tx: DbTransaction,
  productionOrderId: string,
): Promise<ProductionOrder> {
  const [order] = await tx
    .select()
    .from(productionOrders)
    .where(eq(productionOrders.id, productionOrderId))
    .for("update");
  if (!order) throw ApiError.notFound("SPK tidak ditemukan.");
  return order;
}

