import { and, count, eq, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor } from "@/lib/db";
import {
  billsOfMaterials,
  productionLines,
  productionOrders,
  productionRecords,
  productionStages,
  salesOrderItems,
  salesOrders,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { computeMaterialPlanning } from "./planning";
import type { CancelProductionOrderInput, CreateProductionOrderInput } from "./schemas";
import { lockProductionOrder, type ProductionOrder } from "./shared";
import { canCancelProductionOrder, PRODUCTION_STAGE_FLOW } from "./status";

async function plannedQuantityForSoItem(
  executor: DbExecutor,
  salesOrderItemId: string,
): Promise<number> {
  const [row] = await executor
    .select({
      value: sql<number>`coalesce(sum(${productionOrders.plannedQuantity}), 0)::int`,
    })
    .from(productionOrders)
    .where(
      and(
        eq(productionOrders.salesOrderItemId, salesOrderItemId),
        sql`${productionOrders.status} <> 'CANCELLED'`,
      ),
    );
  return Number(row?.value ?? 0);
}

export async function createProductionOrder(
  input: CreateProductionOrderInput,
  actorUserId: string,
): Promise<ProductionOrder> {
  return db.transaction(async (tx) => {
    // Kunci item SO agar dua SPK tidak melebihi kuantitas pesanan bersamaan.
    const [item] = await tx
      .select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.id, input.salesOrderItemId))
      .for("update");
    if (!item) throw ApiError.notFound("Item sales order tidak ditemukan.");

    const [salesOrder] = await tx
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.id, item.salesOrderId))
      .for("update");
    if (!salesOrder) throw ApiError.notFound("Sales order tidak ditemukan.");
    if (salesOrder.status !== "CONFIRMED" && salesOrder.status !== "IN_PRODUCTION") {
      throw ApiError.conflict("SPK hanya dapat dibuat dari sales order yang sudah dikonfirmasi.");
    }

    const alreadyPlanned = await plannedQuantityForSoItem(tx, item.id);
    const remaining = Number(item.quantity) - alreadyPlanned;
    if (input.plannedQuantity > remaining) {
      throw ApiError.badRequest(
        `Sisa kuantitas item ini yang belum direncanakan hanya ${remaining}.`,
      );
    }

    const [bom] = await tx
      .select()
      .from(billsOfMaterials)
      .where(
        and(eq(billsOfMaterials.variantId, item.variantId), eq(billsOfMaterials.isActive, true)),
      )
      .limit(1);
    if (!bom) {
      throw ApiError.badRequest(
        "Varian ini belum memiliki BOM aktif. Lengkapi BOM sebelum membuat SPK.",
      );
    }

    const [line] = await tx
      .select()
      .from(productionLines)
      .where(eq(productionLines.id, input.productionLineId))
      .limit(1);
    if (!line) throw ApiError.badRequest("Lini produksi tidak ditemukan.");
    if (!line.isActive) throw ApiError.badRequest("Lini produksi tidak aktif.");

    // Gate ketersediaan material (task 4.2).
    const planning = await computeMaterialPlanning(tx, {
      bomId: bom.id,
      quantity: input.plannedQuantity,
      needBy: input.plannedEndDate,
    });
    const shortageReason = input.shortageReason?.trim() ? input.shortageReason.trim() : null;
    if (planning.hasShortage && !shortageReason) {
      throw ApiError.conflict(
        `Ketersediaan material kurang untuk ${planning.shortageCount} material. Isi alasan tetap dijalankan atau lengkapi stok terlebih dahulu.`,
      );
    }

    const number = await nextDocumentNumber(tx, "SPK");
    const [created] = await tx
      .insert(productionOrders)
      .values({
        number,
        salesOrderItemId: item.id,
        bomId: bom.id,
        productionLineId: line.id,
        plannedQuantity: input.plannedQuantity,
        plannedStartDate: input.plannedStartDate,
        plannedEndDate: input.plannedEndDate,
        status: "OPEN",
        notes: nullable(input.notes),
        shortageReason,
        createdBy: actorUserId,
      })
      .returning();
    if (!created) throw ApiError.badRequest("Gagal membuat SPK.");

    await tx.insert(productionStages).values(
      PRODUCTION_STAGE_FLOW.map((stage, index) => ({
        productionOrderId: created.id,
        stageCode: stage.code,
        sequenceNumber: index + 1,
        targetQuantity: input.plannedQuantity,
        status: "PENDING" as const,
      })),
    );

    // SPK pertama membuat SO berstatus "Dalam Produksi".
    if (salesOrder.status === "CONFIRMED") {
      await tx
        .update(salesOrders)
        .set({ status: "IN_PRODUCTION" })
        .where(eq(salesOrders.id, salesOrder.id));
    }

    await recordAudit(tx, {
      actorUserId,
      action: "production.create",
      entityType: "production-order",
      entityId: created.id,
      details: {
        number: created.number,
        salesOrderNumber: salesOrder.number,
        plannedQuantity: created.plannedQuantity,
        bomVersion: bom.version,
        shortageCount: planning.shortageCount,
        shortageReason,
      },
    });

    return created;
  });
}

export async function cancelProductionOrder(
  productionOrderId: string,
  input: CancelProductionOrderInput,
  actorUserId: string,
): Promise<ProductionOrder> {
  return db.transaction(async (tx) => {
    const order = await lockProductionOrder(tx, productionOrderId);

    const [recordRow] = await tx
      .select({ value: count() })
      .from(productionRecords)
      .innerJoin(productionStages, eq(productionStages.id, productionRecords.productionStageId))
      .where(eq(productionStages.productionOrderId, order.id));
    const hasRecords = Number(recordRow?.value ?? 0) > 0;

    if (!canCancelProductionOrder(order.status, hasRecords)) {
      throw ApiError.conflict(
        hasRecords
          ? "SPK yang sudah memiliki catatan produksi tidak dapat dibatalkan."
          : "SPK ini tidak dapat dibatalkan.",
      );
    }

    const [updated] = await tx
      .update(productionOrders)
      .set({ status: "CANCELLED", cancelReason: input.reason, cancelledAt: new Date() })
      .where(eq(productionOrders.id, order.id))
      .returning();
    if (!updated) throw ApiError.notFound("SPK tidak ditemukan.");

    // Bila tidak ada SPK aktif lain untuk SO ini, kembalikan status SO.
    const [item] = await tx
      .select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.id, order.salesOrderItemId))
      .limit(1);
    if (item) {
      const [activeRow] = await tx
        .select({ value: count() })
        .from(productionOrders)
        .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
        .where(
          and(
            eq(salesOrderItems.salesOrderId, item.salesOrderId),
            sql`${productionOrders.status} <> 'CANCELLED'`,
          ),
        );
      if (Number(activeRow?.value ?? 0) === 0) {
        await tx
          .update(salesOrders)
          .set({ status: "CONFIRMED" })
          .where(
            and(eq(salesOrders.id, item.salesOrderId), eq(salesOrders.status, "IN_PRODUCTION")),
          );
      }
    }

    await recordAudit(tx, {
      actorUserId,
      action: "production.cancel",
      entityType: "production-order",
      entityId: order.id,
      details: { number: order.number, reason: input.reason },
    });

    return updated;
  });
}
