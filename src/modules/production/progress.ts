import { and, eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import {
  bomItems,
  materialIssueItems,
  materialIssues,
  productionOrders,
  productionRecords,
  productionStages,
  warehouseLocations,
} from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/utils/db-errors";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { postMovement } from "@/modules/inventory/engine";
import type { MaterialIssueInput, StageRecordInput } from "./schemas";
import {
  lockProductionOrder,
  recordAggregates,
  reworkRejectedTotal,
  type ProductionOrder,
  type ProductionStage,
} from "./shared";
import {
  computeProductionOrderStatus,
  computeStageStatus,
  inputQuantityForStage,
  remainingNormalCapacity,
  remainingReworkCapacity,
  validateStageRecordInput,
} from "./status";

export type StageRecordResult = {
  stage: ProductionStage;
  order: ProductionOrder;
};

/**
 * Hitung ulang status satu tahap dari data terkini. Dipakai juga oleh modul
 * QC setelah inspeksi REWORK menambah jatah rework.
 */
export async function recalculateStageProgress(
  tx: DbTransaction,
  stageId: string,
): Promise<ProductionStage> {
  const [stage] = await tx
    .select()
    .from(productionStages)
    .where(eq(productionStages.id, stageId))
    .limit(1);
  if (!stage) throw ApiError.notFound("Tahap produksi tidak ditemukan.");

  const [previous] = await tx
    .select()
    .from(productionStages)
    .where(
      and(
        eq(productionStages.productionOrderId, stage.productionOrderId),
        eq(productionStages.sequenceNumber, stage.sequenceNumber - 1),
      ),
    )
    .limit(1);

  const aggregates = await recordAggregates(tx, stage.id);
  const previousAggregates = previous ? await recordAggregates(tx, previous.id) : null;
  const inputQuantity = inputQuantityForStage({
    sequenceNumber: stage.sequenceNumber,
    targetQuantity: stage.targetQuantity,
    previousPassedQuantity: previousAggregates?.passedTotal ?? 0,
  });
  const reworkCapacity = await reworkRejectedTotal(tx, stage.id);
  const processedTotal = aggregates.processedNormal + aggregates.processedRework;
  const hasRecords = processedTotal > 0;

  const status = computeStageStatus({
    inputQuantity,
    reworkCapacity,
    processedQuantity: processedTotal,
    hasRecords,
  });

  const [updated] = await tx
    .update(productionStages)
    .set({
      status,
      startedAt: hasRecords ? (stage.startedAt ?? new Date()) : null,
      completedAt: status === "COMPLETED" ? (stage.completedAt ?? new Date()) : null,
    })
    .where(eq(productionStages.id, stage.id))
    .returning();
  return updated ?? stage;
}

/** Hitung ulang status SPK dari status keempat tahapnya (+ completedAt). */
export async function recalculateOrderStatus(
  tx: DbTransaction,
  productionOrderId: string,
): Promise<ProductionOrder> {
  const order = await lockProductionOrder(tx, productionOrderId);
  if (order.status === "CANCELLED") return order;

  const stages = await tx
    .select({ status: productionStages.status })
    .from(productionStages)
    .where(eq(productionStages.productionOrderId, productionOrderId));

  const status = computeProductionOrderStatus(stages);
  const [updated] = await tx
    .update(productionOrders)
    .set({
      status,
      completedAt: status === "COMPLETED" ? (order.completedAt ?? new Date()) : null,
    })
    .where(eq(productionOrders.id, productionOrderId))
    .returning();
  return updated ?? order;
}

export async function recordStageOutput(
  productionOrderId: string,
  input: StageRecordInput,
  actorUserId: string,
): Promise<StageRecordResult> {
  const shapeError = validateStageRecordInput(input);
  if (shapeError) throw ApiError.badRequest(shapeError);

  return db.transaction(async (tx) => {
    const order = await lockProductionOrder(tx, productionOrderId);
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("SPK yang dibatalkan tidak dapat dicatat.");
    }

    const [stage] = await tx
      .select()
      .from(productionStages)
      .where(
        and(
          eq(productionStages.productionOrderId, order.id),
          eq(productionStages.stageCode, input.stageCode),
        ),
      )
      .for("update");
    if (!stage) throw ApiError.notFound("Tahap produksi tidak ditemukan.");

    const aggregates = await recordAggregates(tx, stage.id);

    if (input.isRework) {
      const reworkCapacity = await reworkRejectedTotal(tx, stage.id);
      const remaining = remainingReworkCapacity({
        reworkRejectedQuantity: reworkCapacity,
        reworkProcessedQuantity: aggregates.processedRework,
      });
      if (input.processedQuantity > remaining) {
        throw ApiError.badRequest(
          `Sisa jatah rework tahap ini hanya ${remaining} unit. Catat inspeksi REWORK terlebih dahulu.`,
        );
      }
    } else {
      const [previous] = await tx
        .select()
        .from(productionStages)
        .where(
          and(
            eq(productionStages.productionOrderId, order.id),
            eq(productionStages.sequenceNumber, stage.sequenceNumber - 1),
          ),
        )
        .limit(1);
      const previousAggregates = previous ? await recordAggregates(tx, previous.id) : null;
      const inputQuantity = inputQuantityForStage({
        sequenceNumber: stage.sequenceNumber,
        targetQuantity: stage.targetQuantity,
        previousPassedQuantity: previousAggregates?.passedTotal ?? 0,
      });
      const remaining = remainingNormalCapacity({
        inputQuantity,
        normalProcessedQuantity: aggregates.processedNormal,
      });
      if (input.processedQuantity > remaining) {
        throw ApiError.badRequest(
          `Tahap ini hanya dapat memproses maksimum ${remaining} unit lagi (hasil tersedia dari tahap sebelumnya).`,
        );
      }
    }

    const [record] = await tx
      .insert(productionRecords)
      .values({
        productionStageId: stage.id,
        processedQuantity: input.processedQuantity,
        passedQuantity: input.passedQuantity,
        rejectedQuantity: input.rejectedQuantity,
        isRework: input.isRework,
        notes: nullable(input.notes),
        recordedBy: actorUserId,
      })
      .returning();
    if (!record) throw ApiError.badRequest("Gagal mencatat output tahap.");

    const updatedStage = await recalculateStageProgress(tx, stage.id);
    const updatedOrder = await recalculateOrderStatus(tx, order.id);

    await recordAudit(tx, {
      actorUserId,
      action: "production.record-output",
      entityType: "production-record",
      entityId: record.id,
      details: {
        productionOrderNumber: order.number,
        stageCode: stage.stageCode,
        processedQuantity: record.processedQuantity,
        passedQuantity: record.passedQuantity,
        rejectedQuantity: record.rejectedQuantity,
        isRework: record.isRework,
      },
    });

    return { stage: updatedStage, order: updatedOrder };
  });
}

/* ------------------------------------------------------------------ */
/* Mutasi: pemakaian material                                          */
/* ------------------------------------------------------------------ */

export async function issueMaterials(
  productionOrderId: string,
  input: MaterialIssueInput,
  actorUserId: string,
): Promise<typeof materialIssues.$inferSelect> {
  const idempotencyKey = input.idempotencyKey?.trim()
    ? `material-issue:${input.idempotencyKey.trim()}`
    : null;

  try {
    return await db.transaction(async (tx) => {
      const order = await lockProductionOrder(tx, productionOrderId);
      if (order.status === "CANCELLED") {
        throw ApiError.conflict("SPK yang dibatalkan tidak dapat memakai material.");
      }

      if (idempotencyKey) {
        const [existing] = await tx
          .select()
          .from(materialIssues)
          .where(eq(materialIssues.idempotencyKey, idempotencyKey))
          .limit(1);
        if (existing) return existing;
      }

      const [location] = await tx
        .select()
        .from(warehouseLocations)
        .where(eq(warehouseLocations.id, input.locationId))
        .limit(1);
      if (!location) throw ApiError.badRequest("Lokasi pengambilan tidak ditemukan.");
      if (!location.isActive) throw ApiError.badRequest("Lokasi pengambilan tidak aktif.");

      const bomMaterialRows = await tx
        .select({ materialId: bomItems.materialId })
        .from(bomItems)
        .where(eq(bomItems.bomId, order.bomId));
      const allowedMaterials = new Set(bomMaterialRows.map((row) => row.materialId));
      for (const item of input.items) {
        if (!allowedMaterials.has(item.materialId)) {
          throw ApiError.badRequest("Ada material yang tidak termasuk dalam BOM SPK ini.");
        }
      }

      const number = await nextDocumentNumber(tx, "MIS");
      const [issue] = await tx
        .insert(materialIssues)
        .values({
          number,
          productionOrderId: order.id,
          locationId: input.locationId,
          issuedAt: input.issuedAt,
          notes: nullable(input.notes),
          idempotencyKey,
          createdBy: actorUserId,
        })
        .returning();
      if (!issue) throw ApiError.badRequest("Gagal membuat dokumen pemakaian material.");

      await tx.insert(materialIssueItems).values(
        input.items.map((item) => ({
          materialIssueId: issue.id,
          materialId: item.materialId,
          quantity: item.quantity.toFixed(4),
          notes: nullable(item.notes),
        })),
      );

      const movementNumbers: string[] = [];
      for (const item of input.items) {
        const movement = await postMovement(tx, {
          itemType: "MATERIAL",
          materialId: item.materialId,
          transactionType: "ISSUE",
          quantity: item.quantity,
          fromLocationId: input.locationId,
          referenceType: "material-issue",
          referenceId: issue.id,
          notes: `Pemakaian material ${issue.number}`,
          idempotencyKey: `material-issue:${issue.id}:${item.materialId}`,
          postedBy: actorUserId,
        });
        movementNumbers.push(movement.transaction.number);
      }

      await recordAudit(tx, {
        actorUserId,
        action: "production.issue-material",
        entityType: "material-issue",
        entityId: issue.id,
        details: {
          number: issue.number,
          productionOrderNumber: order.number,
          itemCount: input.items.length,
          movementNumbers,
        },
      });

      return issue;
    });
  } catch (error) {
    // Idempotensi race: permintaan berulang paralel → ambil dokumen yang menang.
    if (idempotencyKey && isUniqueViolation(error)) {
      const [existing] = await db
        .select()
        .from(materialIssues)
        .where(eq(materialIssues.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing) return existing;
    }
    throw error;
  }
}

