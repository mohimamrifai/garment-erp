import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { db, type DbExecutor } from "@/lib/db";
import {
  billsOfMaterials,
  bomItems,
  inventoryBalances,
  materialReceiptItems,
  materialReceipts,
  materials,
  purchaseOrderItems,
  purchaseOrders,
  salesOrderItems,
  unitsOfMeasure,
} from "@/lib/db/schema";
import { OPEN_PO_STATUSES } from "@/modules/purchasing/status";
import { toScaled } from "./shared";
import { computeMaterialRequirement } from "./status";

export type MaterialPlanningRow = {
  materialId: string;
  code: string;
  name: string;
  unitCode: string;
  quantityPerUnit: number;
  scrapAllowance: number;
  grossQuantity: number;
  allowanceQuantity: number;
  requiredQuantity: number;
  shortageQuantity: number;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  scheduledQuantity: number;
};

export type MaterialPlanningSummary = {
  rows: MaterialPlanningRow[];
  shortageCount: number;
  hasShortage: boolean;
};

/**
 * Hitung kebutuhan material untuk `quantity` unit dari sebuah BOM
 * (PRD FR-07). `needBy` membatasi penerimaan terjadwal yang boleh dihitung:
 * PO berjalan dengan estimasi kedatangan ≤ needBy (PO tanpa estimasi dihitung).
 */
export async function computeMaterialPlanning(
  executor: DbExecutor,
  options: { bomId: string; quantity: number; needBy: string | null },
): Promise<MaterialPlanningSummary> {
  const items = await executor
    .select({
      materialId: bomItems.materialId,
      code: materials.code,
      name: materials.name,
      unitCode: unitsOfMeasure.code,
      quantityPerUnit: bomItems.quantityPerUnit,
      scrapAllowance: bomItems.scrapAllowance,
    })
    .from(bomItems)
    .innerJoin(materials, eq(bomItems.materialId, materials.id))
    .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
    .where(eq(bomItems.bomId, options.bomId))
    .orderBy(asc(materials.code));

  if (items.length === 0) {
    return { rows: [], shortageCount: 0, hasShortage: false };
  }

  const materialIds = items.map((item) => item.materialId);

  const balanceRows = await executor
    .select({
      materialId: inventoryBalances.materialId,
      onHand: sql<string>`coalesce(sum(${inventoryBalances.quantityOnHand}), 0)`,
      reserved: sql<string>`coalesce(sum(${inventoryBalances.quantityReserved}), 0)`,
    })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.itemType, "MATERIAL"),
        inArray(inventoryBalances.materialId, materialIds),
      ),
    )
    .groupBy(inventoryBalances.materialId);
  const balanceMap = new Map(balanceRows.map((row) => [row.materialId, row]));

  // PO berjalan: sisa pesanan yang estimasi kedatangannya dapat diperhitungkan.
  const orderedRows = await executor
    .select({
      materialId: purchaseOrderItems.materialId,
      ordered: sql<string>`coalesce(sum(${purchaseOrderItems.orderedQuantity}), 0)`,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .where(
      and(
        inArray(purchaseOrders.status, OPEN_PO_STATUSES),
        inArray(purchaseOrderItems.materialId, materialIds),
        options.needBy
          ? or(
              isNull(purchaseOrders.expectedDate),
              sql`${purchaseOrders.expectedDate} <= ${options.needBy}`,
            )
          : undefined,
      ),
    )
    .groupBy(purchaseOrderItems.materialId);
  const orderedMap = new Map(orderedRows.map((row) => [row.materialId, row.ordered]));

  const acceptedRows = await executor
    .select({
      materialId: purchaseOrderItems.materialId,
      accepted: sql<string>`coalesce(sum(${materialReceiptItems.acceptedQuantity}), 0)`,
    })
    .from(materialReceiptItems)
    .innerJoin(
      purchaseOrderItems,
      eq(materialReceiptItems.purchaseOrderItemId, purchaseOrderItems.id),
    )
    .innerJoin(materialReceipts, eq(materialReceiptItems.materialReceiptId, materialReceipts.id))
    .where(
      and(
        eq(materialReceipts.status, "POSTED"),
        inArray(purchaseOrderItems.materialId, materialIds),
      ),
    )
    .groupBy(purchaseOrderItems.materialId);
  const acceptedMap = new Map(acceptedRows.map((row) => [row.materialId, row.accepted]));

  const rows = items.map((item) => {
    const balance = balanceMap.get(item.materialId);
    const onHand = Number(balance?.onHand ?? 0);
    const reserved = Number(balance?.reserved ?? 0);
    const available = Math.max(0, onHand - reserved);
    const orderedScaled = toScaled(Number(orderedMap.get(item.materialId) ?? 0));
    const acceptedScaled = toScaled(Number(acceptedMap.get(item.materialId) ?? 0));
    const scheduled = Math.max(0, (orderedScaled - acceptedScaled) / 10_000);

    const requirement = computeMaterialRequirement({
      plannedQuantity: options.quantity,
      quantityPerUnit: Number(item.quantityPerUnit),
      scrapAllowance: Number(item.scrapAllowance),
      availableQuantity: available,
      scheduledInboundQuantity: scheduled,
    });

    return {
      materialId: item.materialId,
      code: item.code,
      name: item.name,
      unitCode: item.unitCode,
      quantityPerUnit: Number(item.quantityPerUnit),
      scrapAllowance: Number(item.scrapAllowance),
      ...requirement,
      onHandQuantity: onHand,
      reservedQuantity: reserved,
      availableQuantity: available,
      scheduledQuantity: scheduled,
    };
  });

  const shortageCount = rows.filter((row) => row.shortageQuantity > 0).length;
  return { rows, shortageCount, hasShortage: shortageCount > 0 };
}

/** Pratinjau ketersediaan untuk form SPK (gate task 4.2). */
export async function getPlanningPreview(options: {
  salesOrderItemId: string;
  quantity: number;
  needBy?: string | null;
}): Promise<MaterialPlanningSummary & { bomId: string; bomVersion: number }> {
  const [row] = await db
    .select({
      bomId: billsOfMaterials.id,
      bomVersion: billsOfMaterials.version,
    })
    .from(salesOrderItems)
    .innerJoin(
      billsOfMaterials,
      and(
        eq(billsOfMaterials.variantId, salesOrderItems.variantId),
        eq(billsOfMaterials.isActive, true),
      ),
    )
    .where(eq(salesOrderItems.id, options.salesOrderItemId))
    .limit(1);

  if (!row) {
    throw ApiError.badRequest(
      "Varian item ini belum memiliki BOM aktif. Lengkapi BOM sebelum membuat SPK.",
    );
  }

  const summary = await computeMaterialPlanning(db, {
    bomId: row.bomId,
    quantity: options.quantity,
    needBy: options.needBy ?? null,
  });
  return { ...summary, bomId: row.bomId, bomVersion: Number(row.bomVersion) };
}
