import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import {
  billsOfMaterials,
  buyers,
  materialIssueItems,
  materialIssues,
  materials,
  productionLines,
  productionOrders,
  productionRecords,
  productionStages,
  products,
  productVariants,
  qcInspections,
  salesOrderItems,
  salesOrders,
  unitsOfMeasure,
  user,
  warehouseLocations,
  warehouses,
} from "@/lib/db/schema";
import { computeMaterialPlanning, type MaterialPlanningSummary } from "./planning";
import type { ListProductionOrdersQuery } from "./schemas";
import {
  passedByProductionOrder,
  recordAggregates,
  reworkRejectedTotal,
  type ProductionOrder,
} from "./shared";
import {
  inputQuantityForStage,
  remainingNormalCapacity,
  remainingReworkCapacity,
  type ProductionOrderStatus,
  type ProductionStageCode,
  type ProductionStageStatus,
  type QcResult,
} from "./status";

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

