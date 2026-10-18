import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor, type DbTransaction } from "@/lib/db";
import {
  billsOfMaterials,
  bomItems,
  buyers,
  inventoryBalances,
  materialIssueItems,
  materialIssues,
  materialReceiptItems,
  materialReceipts,
  materials,
  productionLines,
  productionOrders,
  productionRecords,
  productionStages,
  products,
  productVariants,
  purchaseOrderItems,
  purchaseOrders,
  qcInspections,
  salesOrderItems,
  salesOrders,
  unitsOfMeasure,
  user,
  warehouseLocations,
  warehouses,
} from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/utils/db-errors";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { postMovement } from "@/modules/inventory/engine";
import { OPEN_PO_STATUSES } from "@/modules/purchasing/status";
import type {
  CancelProductionOrderInput,
  CreateProductionOrderInput,
  ListProductionOrdersQuery,
  MaterialIssueInput,
  StageRecordInput,
} from "./schemas";
import {
  canCancelProductionOrder,
  computeMaterialRequirement,
  computeProductionOrderStatus,
  computeStageStatus,
  inputQuantityForStage,
  PRODUCTION_STAGE_FLOW,
  remainingNormalCapacity,
  remainingReworkCapacity,
  validateStageRecordInput,
  type ProductionOrderStatus,
  type ProductionStageCode,
  type ProductionStageStatus,
  type QcResult,
} from "./status";

/**
 * Service modul produksi (F4 task 4.1–4.5).
 *
 * Invariant utama:
 * - SPK selalu dari item SO terkonfirmasi + BOM aktif yang dikunci.
 * - Output tahap n ≤ output lolos tahap n−1 (tahap 1 = target) — dijaga di
 *   service, dites unit + integration.
 * - Rework tidak menggandakan output: jatah rework berasal dari inspeksi QC
 *   berstatus REWORK dan dikonsumsi hanya oleh catatan `is_rework`.
 * - Pemakaian material mengurangi stok HANYA lewat inventory engine.
 */

export type ProductionOrder = typeof productionOrders.$inferSelect;
export type ProductionStage = typeof productionStages.$inferSelect;
export type ProductionRecord = typeof productionRecords.$inferSelect;

function toScaled(value: number): number {
  return Math.round(value * 10_000);
}

/* ------------------------------------------------------------------ */
/* Query baca: daftar SPK                                              */
/* ------------------------------------------------------------------ */

export type ProductionOrderListRow = {
  id: string;
  number: string;
  status: ProductionOrderStatus;
  plannedQuantity: number;
  plannedStartDate: string;
  plannedEndDate: string;
  salesOrderNumber: string;
  buyerName: string;
  variantSku: string;
  productName: string;
  size: string;
  color: string;
  lineName: string | null;
  /** Output lolos tahap akhir (packing) — indikator progress. */
  outputQuantity: number;
  createdAt: Date;
};

/** Total lolos (passed) catatan tahap packing per SPK, dipakai untuk progress. */
async function passedByProductionOrder(
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

export async function listProductionOrders(
  params: ListProductionOrdersQuery,
): Promise<{ items: ProductionOrderListRow[]; total: number }> {
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(productionOrders.number, pattern),
        ilike(salesOrders.number, pattern),
        ilike(products.name, pattern),
        ilike(productVariants.variantSku, pattern),
      ),
    );
  }
  if (params.status !== "all") conditions.push(eq(productionOrders.status, params.status));
  if (params.line) conditions.push(eq(productionOrders.productionLineId, params.line));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(productionOrders)
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(salesOrders, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(where);

  const rows = await db
    .select({
      id: productionOrders.id,
      number: productionOrders.number,
      status: productionOrders.status,
      plannedQuantity: productionOrders.plannedQuantity,
      plannedStartDate: productionOrders.plannedStartDate,
      plannedEndDate: productionOrders.plannedEndDate,
      salesOrderNumber: salesOrders.number,
      buyerName: buyers.name,
      variantSku: productVariants.variantSku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      lineName: productionLines.name,
      createdAt: productionOrders.createdAt,
    })
    .from(productionOrders)
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(salesOrders, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(productionLines, eq(productionOrders.productionLineId, productionLines.id))
    .where(where)
    .orderBy(desc(productionOrders.createdAt), desc(productionOrders.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const passedMap = await passedByProductionOrder(
    db,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => ({
      ...row,
      plannedQuantity: Number(row.plannedQuantity),
      outputQuantity: passedMap.get(row.id) ?? 0,
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Query baca: item SO yang dapat dijadikan SPK                        */
/* ------------------------------------------------------------------ */

export type ProducibleSoItemOption = {
  salesOrderItemId: string;
  salesOrderNumber: string;
  salesOrderStatus: string;
  buyerName: string;
  dueDate: string;
  variantId: string;
  variantSku: string;
  size: string;
  color: string;
  productName: string;
  quantity: number;
  plannedQuantity: number;
  remainingQuantity: number;
  bomId: string;
  bomVersion: number;
};

/** Item SO terkonfirmasi yang punya BOM aktif dan sisa belum direncanakan. */
export async function listProducibleSalesOrderItems(): Promise<ProducibleSoItemOption[]> {
  const rows = await db
    .select({
      salesOrderItemId: salesOrderItems.id,
      salesOrderNumber: salesOrders.number,
      salesOrderStatus: salesOrders.status,
      buyerName: buyers.name,
      dueDate: salesOrders.dueDate,
      variantId: salesOrderItems.variantId,
      variantSku: productVariants.variantSku,
      size: productVariants.size,
      color: productVariants.color,
      productName: products.name,
      quantity: salesOrderItems.quantity,
      bomId: billsOfMaterials.id,
      bomVersion: billsOfMaterials.version,
      planned: sql<number>`coalesce((
        select sum(po.planned_quantity) from production_orders po
        where po.sales_order_item_id = ${salesOrderItems.id} and po.status <> 'CANCELLED'
      ), 0)::int`,
    })
    .from(salesOrderItems)
    .innerJoin(salesOrders, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(
      billsOfMaterials,
      and(
        eq(billsOfMaterials.variantId, salesOrderItems.variantId),
        eq(billsOfMaterials.isActive, true),
      ),
    )
    .where(inArray(salesOrders.status, ["CONFIRMED", "IN_PRODUCTION"]))
    .orderBy(asc(salesOrders.dueDate), asc(salesOrders.number));

  return rows
    .map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      bomVersion: Number(row.bomVersion),
      plannedQuantity: Number(row.planned),
      remainingQuantity: Number(row.quantity) - Number(row.planned),
    }))
    .filter((row) => row.remainingQuantity > 0);
}

/* ------------------------------------------------------------------ */
/* Material planning (FR-07)                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Query baca: detail SPK                                              */
/* ------------------------------------------------------------------ */

export type ProductionStageRecordRow = {
  id: string;
  processedQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
  isRework: boolean;
  notes: string | null;
  recordedByName: string | null;
  recordedAt: Date;
};

export type ProductionStageInspectionRow = {
  id: string;
  number: string;
  inspectedQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
  result: QcResult;
  notes: string | null;
  inspectedAt: Date;
  parentInspectionId: string | null;
};

export type ProductionStageDetail = {
  id: string;
  stageCode: ProductionStageCode;
  sequenceNumber: number;
  targetQuantity: number;
  status: ProductionStageStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  inputQuantity: number;
  reworkCapacity: number;
  processedQuantity: number;
  normalProcessedQuantity: number;
  reworkProcessedQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
  /** Sisa yang masih boleh diproses (normal + rework). */
  remainingQuantity: number;
  records: ProductionStageRecordRow[];
  inspections: ProductionStageInspectionRow[];
};

export type ProductionOrderIssueRow = {
  id: string;
  number: string;
  issuedAt: string;
  locationLabel: string;
  notes: string | null;
  createdByName: string | null;
  createdAt: Date;
  items: {
    id: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    quantity: string;
  }[];
};

export type ProductionOrderDetail = {
  order: ProductionOrder;
  salesOrder: {
    id: string;
    number: string;
    status: string;
    buyerName: string;
    dueDate: string;
  };
  item: {
    id: string;
    variantId: string;
    variantSku: string;
    size: string;
    color: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: string;
  };
  bom: { id: string; version: number; effectiveFrom: string };
  line: { id: string; code: string; name: string } | null;
  stages: ProductionStageDetail[];
  planning: MaterialPlanningSummary;
  issues: ProductionOrderIssueRow[];
  totals: {
    plannedQuantity: number;
    processedQuantity: number;
    passedQuantity: number;
    rejectedQuantity: number;
    /** Lolos tahap terakhir (packing). */
    outputQuantity: number;
    issuedLineCount: number;
  };
};

type RecordAggregates = {
  processedNormal: number;
  processedRework: number;
  passedTotal: number;
  rejectedTotal: number;
};

async function recordAggregates(executor: DbExecutor, stageId: string): Promise<RecordAggregates> {
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
async function reworkRejectedTotal(executor: DbExecutor, stageId: string): Promise<number> {
  const [row] = await executor
    .select({
      value: sql<number>`coalesce(sum(${qcInspections.rejectedQuantity}), 0)::int`,
    })
    .from(qcInspections)
    .where(and(eq(qcInspections.productionStageId, stageId), eq(qcInspections.result, "REWORK")));
  return Number(row?.value ?? 0);
}

export async function getProductionOrderDetail(
  productionOrderId: string,
): Promise<ProductionOrderDetail> {
  const [row] = await db
    .select({
      order: productionOrders,
      salesOrder: {
        id: salesOrders.id,
        number: salesOrders.number,
        status: salesOrders.status,
        buyerName: buyers.name,
        dueDate: salesOrders.dueDate,
      },
      item: {
        id: salesOrderItems.id,
        variantId: salesOrderItems.variantId,
        variantSku: productVariants.variantSku,
        size: productVariants.size,
        color: productVariants.color,
        productName: products.name,
        productSku: products.sku,
        quantity: salesOrderItems.quantity,
        unitPrice: salesOrderItems.unitPrice,
      },
      bom: {
        id: billsOfMaterials.id,
        version: billsOfMaterials.version,
        effectiveFrom: billsOfMaterials.effectiveFrom,
      },
      line: {
        id: productionLines.id,
        code: productionLines.code,
        name: productionLines.name,
      },
    })
    .from(productionOrders)
    .innerJoin(salesOrderItems, eq(productionOrders.salesOrderItemId, salesOrderItems.id))
    .innerJoin(salesOrders, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .innerJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(billsOfMaterials, eq(productionOrders.bomId, billsOfMaterials.id))
    .leftJoin(productionLines, eq(productionOrders.productionLineId, productionLines.id))
    .where(eq(productionOrders.id, productionOrderId))
    .limit(1);

  if (!row) throw ApiError.notFound("SPK tidak ditemukan.");

  const stageRows = await db
    .select()
    .from(productionStages)
    .where(eq(productionStages.productionOrderId, productionOrderId))
    .orderBy(asc(productionStages.sequenceNumber));

  const stageIds = stageRows.map((stage) => stage.id);

  const recordRows =
    stageIds.length === 0
      ? []
      : await db
          .select({
            id: productionRecords.id,
            productionStageId: productionRecords.productionStageId,
            processedQuantity: productionRecords.processedQuantity,
            passedQuantity: productionRecords.passedQuantity,
            rejectedQuantity: productionRecords.rejectedQuantity,
            isRework: productionRecords.isRework,
            notes: productionRecords.notes,
            recordedAt: productionRecords.recordedAt,
            recordedByName: user.name,
          })
          .from(productionRecords)
          .leftJoin(user, eq(productionRecords.recordedBy, user.id))
          .where(inArray(productionRecords.productionStageId, stageIds))
          .orderBy(asc(productionRecords.recordedAt));

  const inspectionRows =
    stageIds.length === 0
      ? []
      : await db
          .select({
            id: qcInspections.id,
            number: qcInspections.number,
            productionStageId: qcInspections.productionStageId,
            inspectedQuantity: qcInspections.inspectedQuantity,
            passedQuantity: qcInspections.passedQuantity,
            rejectedQuantity: qcInspections.rejectedQuantity,
            result: qcInspections.result,
            notes: qcInspections.notes,
            inspectedAt: qcInspections.inspectedAt,
            parentInspectionId: qcInspections.parentInspectionId,
          })
          .from(qcInspections)
          .where(inArray(qcInspections.productionStageId, stageIds))
          .orderBy(asc(qcInspections.inspectedAt));

  const issueRows = await db
    .select({
      id: materialIssues.id,
      number: materialIssues.number,
      issuedAt: materialIssues.issuedAt,
      notes: materialIssues.notes,
      createdAt: materialIssues.createdAt,
      locationCode: warehouseLocations.code,
      locationName: warehouseLocations.name,
      warehouseName: warehouses.name,
      createdByName: user.name,
    })
    .from(materialIssues)
    .innerJoin(warehouseLocations, eq(materialIssues.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .leftJoin(user, eq(materialIssues.createdBy, user.id))
    .where(eq(materialIssues.productionOrderId, productionOrderId))
    .orderBy(desc(materialIssues.createdAt));

  const issueItemRows =
    issueRows.length === 0
      ? []
      : await db
          .select({
            id: materialIssueItems.id,
            materialIssueId: materialIssueItems.materialIssueId,
            materialId: materialIssueItems.materialId,
            materialCode: materials.code,
            materialName: materials.name,
            unitCode: unitsOfMeasure.code,
            quantity: materialIssueItems.quantity,
          })
          .from(materialIssueItems)
          .innerJoin(materials, eq(materialIssueItems.materialId, materials.id))
          .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
          .where(
            inArray(
              materialIssueItems.materialIssueId,
              issueRows.map((issue) => issue.id),
            ),
          )
          .orderBy(asc(materials.code));

  const planning = await computeMaterialPlanning(db, {
    bomId: row.bom.id,
    quantity: Number(row.order.plannedQuantity),
    needBy: row.order.plannedEndDate,
  });

  const stages: ProductionStageDetail[] = [];
  for (const stage of stageRows) {
    const aggregates = await recordAggregates(db, stage.id);
    const previous = stageRows.find(
      (candidate) => candidate.sequenceNumber === stage.sequenceNumber - 1,
    );
    const previousPassed = previous ? (await recordAggregates(db, previous.id)).passedTotal : 0;
    const inputQuantity = inputQuantityForStage({
      sequenceNumber: stage.sequenceNumber,
      targetQuantity: stage.targetQuantity,
      previousPassedQuantity: previousPassed,
    });
    const reworkCapacity = await reworkRejectedTotal(db, stage.id);
    const processedQuantity = aggregates.processedNormal + aggregates.processedRework;
    const remaining =
      remainingNormalCapacity({
        inputQuantity,
        normalProcessedQuantity: aggregates.processedNormal,
      }) +
      remainingReworkCapacity({
        reworkRejectedQuantity: reworkCapacity,
        reworkProcessedQuantity: aggregates.processedRework,
      });

    stages.push({
      id: stage.id,
      stageCode: stage.stageCode,
      sequenceNumber: stage.sequenceNumber,
      targetQuantity: stage.targetQuantity,
      status: stage.status,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      inputQuantity,
      reworkCapacity,
      processedQuantity,
      normalProcessedQuantity: aggregates.processedNormal,
      reworkProcessedQuantity: aggregates.processedRework,
      passedQuantity: aggregates.passedTotal,
      rejectedQuantity: aggregates.rejectedTotal,
      remainingQuantity: remaining,
      records: recordRows
        .filter((record) => record.productionStageId === stage.id)
        .map((record) => ({
          id: record.id,
          processedQuantity: record.processedQuantity,
          passedQuantity: record.passedQuantity,
          rejectedQuantity: record.rejectedQuantity,
          isRework: record.isRework,
          notes: record.notes,
          recordedByName: record.recordedByName,
          recordedAt: record.recordedAt,
        })),
      inspections: inspectionRows
        .filter((inspection) => inspection.productionStageId === stage.id)
        .map((inspection) => ({
          id: inspection.id,
          number: inspection.number,
          inspectedQuantity: inspection.inspectedQuantity,
          passedQuantity: inspection.passedQuantity,
          rejectedQuantity: inspection.rejectedQuantity,
          result: inspection.result,
          notes: inspection.notes,
          inspectedAt: inspection.inspectedAt,
          parentInspectionId: inspection.parentInspectionId,
        })),
    });
  }

  const issues: ProductionOrderIssueRow[] = issueRows.map((issue) => ({
    id: issue.id,
    number: issue.number,
    issuedAt: issue.issuedAt,
    locationLabel: `${issue.warehouseName} — ${issue.locationCode} (${issue.locationName})`,
    notes: issue.notes,
    createdByName: issue.createdByName,
    createdAt: issue.createdAt,
    items: issueItemRows
      .filter((item) => item.materialIssueId === issue.id)
      .map((item) => ({
        id: item.id,
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialName: item.materialName,
        unitCode: item.unitCode,
        quantity: item.quantity,
      })),
  }));

  const totals = stages.reduce(
    (acc, stage) => ({
      processedQuantity: acc.processedQuantity + stage.processedQuantity,
      passedQuantity: acc.passedQuantity + stage.passedQuantity,
      rejectedQuantity: acc.rejectedQuantity + stage.rejectedQuantity,
    }),
    { processedQuantity: 0, passedQuantity: 0, rejectedQuantity: 0 },
  );
  const packing = stages.find((stage) => stage.stageCode === "PACKING");

  return {
    order: row.order,
    salesOrder: row.salesOrder,
    item: row.item,
    bom: row.bom,
    line: row.line,
    stages,
    planning,
    issues,
    totals: {
      plannedQuantity: Number(row.order.plannedQuantity),
      ...totals,
      outputQuantity: packing?.passedQuantity ?? 0,
      issuedLineCount: issueItemRows.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Mutasi: buat & batalkan SPK                                         */
/* ------------------------------------------------------------------ */

async function lockProductionOrder(
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

/* ------------------------------------------------------------------ */
/* Mutasi: catat output tahap                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Ringkasan dashboard                                                 */
/* ------------------------------------------------------------------ */

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
