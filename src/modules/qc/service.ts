import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor } from "@/lib/db";
import {
  buyers,
  productionOrders,
  productionRecords,
  productionStages,
  products,
  productVariants,
  qcDefects,
  qcInspections,
  salesOrderItems,
  salesOrders,
  user,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { recordFinishedGoodsLot } from "@/modules/finished-goods/service";
import {
  recalculateOrderStatus,
  recalculateStageProgress,
} from "@/modules/production/service";
import {
  QC_RESULT_LABELS,
  remainingInspectableQuantity,
  remainingReworkInspectableQuantity,
  validateQcCounts,
  type ProductionStageCode,
  type QcResult,
} from "@/modules/production/status";
import type { CreateQcInspectionInput, ListQcInspectionsQuery } from "./schemas";

/**
 * Service modul QC (F4 task 4.6–4.7).
 *
 * Aturan:
 * - Inspeksi pertama sebuah tahap dibatasi total output lolos tahap itu.
 * - Inspeksi ulang (rework) dibatasi kuantitas yang ditolak inspeksi induk;
 *   rangkaian anak tidak boleh melebihi jatah induk → tidak ada penggandaan.
 * - Total cacat yang dirinci tidak boleh melebihi kuantitas ditolak.
 * - Inspeksi REWORK menambah jatah rework tahap terkait (barang diproses ulang
 *   lewat catatan produksi bertanda `is_rework`).
 */

export type QcInspection = typeof qcInspections.$inferSelect;
export type QcDefect = typeof qcDefects.$inferSelect;

export { QC_RESULT_LABELS };
export type { QcResult };

/* ------------------------------------------------------------------ */
/* Query baca: daftar inspeksi                                         */
/* ------------------------------------------------------------------ */

export type QcInspectionListRow = {
  id: string;
  number: string;
  productionOrderId: string;
  productionOrderNumber: string;
  stageCode: ProductionStageCode;
  productName: string;
  variantSku: string;
  inspectedQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
  result: QcResult;
  parentInspectionId: string | null;
  parentNumber: string | null;
  inspectedByName: string | null;
  inspectedAt: Date;
  defectCount: number;
};

export async function listQcInspections(
  params: ListQcInspectionsQuery,
): Promise<{ items: QcInspectionListRow[]; total: number }> {
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(qcInspections.number, pattern),
        ilike(productionOrders.number, pattern),
        ilike(products.name, pattern),
        ilike(productVariants.variantSku, pattern),
      ),
    );
  }
  if (params.result !== "all") conditions.push(eq(qcInspections.result, params.result));
  if (params.stage !== "all") conditions.push(eq(productionStages.stageCode, params.stage));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const joinBase = () =>
    db
      .select({
        id: qcInspections.id,
        number: qcInspections.number,
        productionOrderId: productionOrders.id,
        productionOrderNumber: productionOrders.number,
        stageCode: productionStages.stageCode,
        productName: products.name,
        variantSku: productVariants.variantSku,
        inspectedQuantity: qcInspections.inspectedQuantity,
        passedQuantity: qcInspections.passedQuantity,
        rejectedQuantity: qcInspections.rejectedQuantity,
        result: qcInspections.result,
        parentInspectionId: qcInspections.parentInspectionId,
        inspectedByName: user.name,
        inspectedAt: qcInspections.inspectedAt,
      })
      .from(qcInspections)
      .innerJoin(productionStages, eq(qcInspections.productionStageId, productionStages.id))
      .innerJoin(productionOrders, eq(productionStages.productionOrderId, productionOrders.id))
      .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
      .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(user, eq(qcInspections.inspectedBy, user.id));

  const [totalRow] = await db
    .select({ value: count() })
    .from(qcInspections)
    .innerJoin(productionStages, eq(qcInspections.productionStageId, productionStages.id))
    .innerJoin(productionOrders, eq(productionStages.productionOrderId, productionOrders.id))
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(where);

  const rows = await joinBase()
    .where(where)
    .orderBy(desc(qcInspections.inspectedAt), desc(qcInspections.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const pageIds = rows.map((row) => row.id);
  const parentIds = rows
    .map((row) => row.parentInspectionId)
    .filter((value): value is string => value !== null);

  const parentNumbers = new Map<string, string>();
  if (parentIds.length > 0) {
    const parentRows = await db
      .select({ id: qcInspections.id, number: qcInspections.number })
      .from(qcInspections)
      .where(inArray(qcInspections.id, parentIds));
    for (const parent of parentRows) parentNumbers.set(parent.id, parent.number);
  }

  const defectCounts = new Map<string, number>();
  if (pageIds.length > 0) {
    const defectRows = await db
      .select({ inspectionId: qcDefects.inspectionId, value: count() })
      .from(qcDefects)
      .where(inArray(qcDefects.inspectionId, pageIds))
      .groupBy(qcDefects.inspectionId);
    for (const defect of defectRows) defectCounts.set(defect.inspectionId, Number(defect.value));
  }

  return {
    items: rows.map((row) => ({
      ...row,
      parentNumber: row.parentInspectionId
        ? (parentNumbers.get(row.parentInspectionId) ?? null)
        : null,
      defectCount: defectCounts.get(row.id) ?? 0,
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Query baca: detail inspeksi                                         */
/* ------------------------------------------------------------------ */

export type QcInspectionDetail = {
  inspection: QcInspection;
  stage: {
    id: string;
    stageCode: ProductionStageCode;
    sequenceNumber: number;
    targetQuantity: number;
    status: string;
  };
  order: {
    id: string;
    number: string;
    status: string;
    plannedQuantity: number;
    plannedEndDate: string;
  };
  item: {
    variantSku: string;
    size: string;
    color: string;
    productName: string;
  };
  buyerName: string;
  inspectedByName: string | null;
  defects: {
    id: string;
    defectCode: string;
    defectName: string;
    quantity: number;
    disposition: string | null;
  }[];
  parent: { id: string; number: string; rejectedQuantity: number } | null;
  children: {
    id: string;
    number: string;
    inspectedQuantity: number;
    passedQuantity: number;
    rejectedQuantity: number;
    result: QcResult;
    inspectedAt: Date;
  }[];
};

export async function getQcInspectionDetail(inspectionId: string): Promise<QcInspectionDetail> {
  const [row] = await db
    .select({
      inspection: qcInspections,
      stage: {
        id: productionStages.id,
        stageCode: productionStages.stageCode,
        sequenceNumber: productionStages.sequenceNumber,
        targetQuantity: productionStages.targetQuantity,
        status: productionStages.status,
      },
      order: {
        id: productionOrders.id,
        number: productionOrders.number,
        status: productionOrders.status,
        plannedQuantity: productionOrders.plannedQuantity,
        plannedEndDate: productionOrders.plannedEndDate,
      },
      item: {
        variantSku: productVariants.variantSku,
        size: productVariants.size,
        color: productVariants.color,
        productName: products.name,
      },
      buyerName: buyers.name,
      inspectedByName: user.name,
    })
    .from(qcInspections)
    .innerJoin(productionStages, eq(qcInspections.productionStageId, productionStages.id))
    .innerJoin(productionOrders, eq(productionStages.productionOrderId, productionOrders.id))
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(buyers, eq(buyers.id, salesOrders.buyerId))
    .leftJoin(user, eq(qcInspections.inspectedBy, user.id))
    .where(eq(qcInspections.id, inspectionId))
    .limit(1);

  if (!row) throw ApiError.notFound("Inspeksi QC tidak ditemukan.");

  const defectRows = await db
    .select()
    .from(qcDefects)
    .where(eq(qcDefects.inspectionId, inspectionId))
    .orderBy(asc(qcDefects.defectCode));

  const parent = row.inspection.parentInspectionId
    ? (
        await db
          .select({
            id: qcInspections.id,
            number: qcInspections.number,
            rejectedQuantity: qcInspections.rejectedQuantity,
          })
          .from(qcInspections)
          .where(eq(qcInspections.id, row.inspection.parentInspectionId))
          .limit(1)
      )[0] ?? null
    : null;

  const children = await db
    .select({
      id: qcInspections.id,
      number: qcInspections.number,
      inspectedQuantity: qcInspections.inspectedQuantity,
      passedQuantity: qcInspections.passedQuantity,
      rejectedQuantity: qcInspections.rejectedQuantity,
      result: qcInspections.result,
      inspectedAt: qcInspections.inspectedAt,
    })
    .from(qcInspections)
    .where(eq(qcInspections.parentInspectionId, inspectionId))
    .orderBy(asc(qcInspections.inspectedAt));

  return {
    inspection: row.inspection,
    stage: row.stage,
    order: row.order,
    item: row.item,
    buyerName: row.buyerName,
    inspectedByName: row.inspectedByName,
    defects: defectRows.map((defect) => ({
      id: defect.id,
      defectCode: defect.defectCode,
      defectName: defect.defectName,
      quantity: defect.quantity,
      disposition: defect.disposition,
    })),
    parent,
    children,
  };
}

/* ------------------------------------------------------------------ */
/* Mutasi: buat inspeksi                                               */
/* ------------------------------------------------------------------ */

async function topLevelInspectedQuantity(
  executor: DbExecutor,
  stageId: string,
): Promise<number> {
  const [row] = await executor
    .select({
      value: sql<number>`coalesce(sum(${qcInspections.inspectedQuantity}), 0)::int`,
    })
    .from(qcInspections)
    .where(
      and(
        eq(qcInspections.productionStageId, stageId),
        isNull(qcInspections.parentInspectionId),
      ),
    );
  return Number(row?.value ?? 0);
}

async function stagePassedQuantity(executor: DbExecutor, stageId: string): Promise<number> {
  const [row] = await executor
    .select({
      value: sql<number>`coalesce(sum(${productionRecords.passedQuantity}), 0)::int`,
    })
    .from(productionRecords)
    .where(eq(productionRecords.productionStageId, stageId));
  return Number(row?.value ?? 0);
}

async function followedUpQuantity(
  executor: DbExecutor,
  parentInspectionId: string,
): Promise<number> {
  const [row] = await executor
    .select({
      value: sql<number>`coalesce(sum(${qcInspections.inspectedQuantity}), 0)::int`,
    })
    .from(qcInspections)
    .where(eq(qcInspections.parentInspectionId, parentInspectionId));
  return Number(row?.value ?? 0);
}

export async function createQcInspection(
  input: CreateQcInspectionInput,
  actorUserId: string,
): Promise<QcInspection> {
  const shapeError = validateQcCounts(input);
  if (shapeError) throw ApiError.badRequest(shapeError);
  if (input.result === "REWORK" && input.rejectedQuantity <= 0) {
    throw ApiError.badRequest("Hasil Rework memerlukan kuantitas cacat lebih dari 0.");
  }

  const defectTotal = input.defects.reduce((total, defect) => total + defect.quantity, 0);
  if (defectTotal > input.rejectedQuantity) {
    throw ApiError.badRequest("Total kuantitas cacat tidak boleh melebihi kuantitas ditolak.");
  }

  return db.transaction(async (tx) => {
    // Kunci tahap agar dua inspeksi paralel tidak melewati batas kuantitas.
    const [stage] = await tx
      .select()
      .from(productionStages)
      .where(eq(productionStages.id, input.productionStageId))
      .for("update");
    if (!stage) throw ApiError.notFound("Tahap produksi tidak ditemukan.");

    let parentInspection: QcInspection | null = null;
    if (input.parentInspectionId) {
      const [parent] = await tx
        .select()
        .from(qcInspections)
        .where(eq(qcInspections.id, input.parentInspectionId))
        .for("update");
      if (!parent) throw ApiError.notFound("Inspeksi induk tidak ditemukan.");
      if (parent.productionStageId !== stage.id) {
        throw ApiError.badRequest("Inspeksi ulang harus pada tahap yang sama dengan inspeksi induk.");
      }
      if (parent.result !== "REWORK" && parent.result !== "FAIL") {
        throw ApiError.badRequest("Inspeksi ulang hanya untuk inspeksi induk berstatus Rework atau Gagal.");
      }
      parentInspection = parent;

      const followed = await followedUpQuantity(tx, parent.id);
      const remaining = remainingReworkInspectableQuantity({
        parentRejectedQuantity: parent.rejectedQuantity,
        followedUpQuantity: followed,
      });
      if (input.inspectedQuantity > remaining) {
        throw ApiError.badRequest(
          `Sisa kuantitas rework inspeksi induk hanya ${remaining} unit yang dapat diperiksa ulang.`,
        );
      }
    } else {
      const passed = await stagePassedQuantity(tx, stage.id);
      const inspected = await topLevelInspectedQuantity(tx, stage.id);
      const remaining = remainingInspectableQuantity({
        stagePassedQuantity: passed,
        alreadyInspectedQuantity: inspected,
      });
      if (input.inspectedQuantity > remaining) {
        throw ApiError.badRequest(
          `Sisa output tahap ini yang dapat diperiksa hanya ${remaining} unit.`,
        );
      }
    }

    const number = await nextDocumentNumber(tx, "QC");
    const [inspection] = await tx
      .insert(qcInspections)
      .values({
        number,
        productionStageId: stage.id,
        inspectedQuantity: input.inspectedQuantity,
        passedQuantity: input.passedQuantity,
        rejectedQuantity: input.rejectedQuantity,
        result: input.result,
        parentInspectionId: parentInspection?.id ?? null,
        notes: nullable(input.notes),
        inspectedBy: actorUserId,
      })
      .returning();
    if (!inspection) throw ApiError.badRequest("Gagal menyimpan inspeksi QC.");

    if (input.defects.length > 0) {
      await tx.insert(qcDefects).values(
        input.defects.map((defect) => ({
          inspectionId: inspection.id,
          defectCode: defect.defectCode,
          defectName: defect.defectName,
          quantity: defect.quantity,
          disposition: nullable(defect.disposition),
        })),
      );
    }

    // Inspeksi REWORK menambah jatah rework tahap → status tahap/SPK dihitung ulang.
    if (input.result === "REWORK") {
      await recalculateStageProgress(tx, stage.id);
      await recalculateOrderStatus(tx, stage.productionOrderId);
    }

    // Lolos QC akhir (tahap packing) → catat lot barang jadi + saldo via engine.
    if (
      stage.stageCode === "PACKING" &&
      input.result === "PASS" &&
      input.passedQuantity > 0
    ) {
      const [soItem] = await tx
        .select({ variantId: salesOrderItems.variantId })
        .from(productionOrders)
        .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
        .where(eq(productionOrders.id, stage.productionOrderId))
        .limit(1);
      if (!soItem) throw ApiError.badRequest("Item sales order SPK tidak ditemukan.");

      await recordFinishedGoodsLot(tx, {
        productionOrderId: stage.productionOrderId,
        qcInspectionId: inspection.id,
        variantId: soItem.variantId,
        quantity: input.passedQuantity,
        createdBy: actorUserId,
        notes: `Barang jadi lolos QC akhir (${inspection.number}).`,
      });
    }

    await recordAudit(tx, {
      actorUserId,
      action: "qc.inspect",
      entityType: "qc-inspection",
      entityId: inspection.id,
      details: {
        number: inspection.number,
        stageCode: stage.stageCode,
        inspectedQuantity: inspection.inspectedQuantity,
        passedQuantity: inspection.passedQuantity,
        rejectedQuantity: inspection.rejectedQuantity,
        result: inspection.result,
        parentNumber: parentInspection?.number ?? null,
        defectCount: input.defects.length,
      },
    });

    return inspection;
  });
}
