import "dotenv/config";
import { asc, eq, sql } from "drizzle-orm";
import { db, sql as dbSql } from "@/lib/db";
import {
  finishedGoods,
  materialIssueItems,
  materialIssues,
  materialReceiptItems,
  materialReceipts,
  materials,
  productionOrders,
  productVariants,
  purchaseOrderItems,
  purchaseOrders,
  salesOrderItems,
  salesOrders,
  shipmentItems,
  shipments,
} from "@/lib/db/schema";
import {
  postFinishedGoodsToAccounting,
  postMaterialIssueToAccounting,
  postMaterialReceiptToAccounting,
  postShipmentToAccounting,
} from "@/modules/accounting/integration";

const actorUserId = process.env.BACKFILL_ACTOR_USER_ID ?? null;

async function backfillReceipts(): Promise<number> {
  const rows = await db
    .select()
    .from(materialReceipts)
    .where(eq(materialReceipts.status, "POSTED"))
    .orderBy(asc(materialReceipts.receivedAt), asc(materialReceipts.number));
  let count = 0;
  for (const receipt of rows) {
    await db.transaction(async (tx) => {
        const [order] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, receipt.purchaseOrderId))
        .limit(1);
        if (!order) return;
        const items = await tx
        .select({
          materialId: purchaseOrderItems.materialId,
          materialName: materials.name,
          acceptedQuantity: materialReceiptItems.acceptedQuantity,
          unitPrice: purchaseOrderItems.unitPrice,
        })
        .from(materialReceiptItems)
        .innerJoin(
          purchaseOrderItems,
          eq(materialReceiptItems.purchaseOrderItemId, purchaseOrderItems.id),
        )
        .innerJoin(materials, eq(purchaseOrderItems.materialId, materials.id))
        .where(eq(materialReceiptItems.materialReceiptId, receipt.id));
      await postMaterialReceiptToAccounting(tx, receipt, order, items, actorUserId);
      count += 1;
    });
  }
  return count;
}

async function backfillMaterialIssues(): Promise<number> {
  const rows = await db
    .select()
    .from(materialIssues)
    .where(sql`${materialIssues.totalCost} = 0`)
    .orderBy(asc(materialIssues.issuedAt), asc(materialIssues.number));
  let count = 0;
  for (const issue of rows) {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(productionOrders)
        .where(eq(productionOrders.id, issue.productionOrderId))
        .limit(1);
      if (!order) return;
      const items = await tx
        .select({
          materialId: materialIssueItems.materialId,
          quantity: materialIssueItems.quantity,
        })
        .from(materialIssueItems)
        .where(eq(materialIssueItems.materialIssueId, issue.id));
      await postMaterialIssueToAccounting(tx, issue, order, items, actorUserId);
      count += 1;
    });
  }
  return count;
}

async function backfillFinishedGoods(): Promise<number> {
  const rows = await db
    .select()
    .from(finishedGoods)
    .where(sql`${finishedGoods.totalCost} = 0`)
    .orderBy(asc(finishedGoods.createdAt));
  let count = 0;
  for (const lot of rows) {
    await db.transaction(async (tx) => {
      await postFinishedGoodsToAccounting(tx, lot, actorUserId);
      count += 1;
    });
  }
  return count;
}

async function backfillShipments(): Promise<number> {
  const rows = await db
    .select()
    .from(shipments)
    .where(eq(shipments.status, "POSTED"))
    .orderBy(asc(shipments.shippedAt), asc(shipments.number));
  let count = 0;
  for (const shipment of rows) {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.id, shipment.salesOrderId))
        .limit(1);
      if (!order) return;
      const items = await tx
        .select({
          salesOrderItemId: shipmentItems.salesOrderItemId,
          variantId: shipmentItems.variantId,
          variantSku: productVariants.variantSku,
          quantity: shipmentItems.quantity,
          unitPrice: salesOrderItems.unitPrice,
        })
        .from(shipmentItems)
        .innerJoin(salesOrderItems, eq(shipmentItems.salesOrderItemId, salesOrderItems.id))
        .innerJoin(productVariants, eq(shipmentItems.variantId, productVariants.id))
        .where(eq(shipmentItems.shipmentId, shipment.id));
      await postShipmentToAccounting(tx, shipment, order, items, actorUserId);
      count += 1;
    });
  }
  return count;
}

async function main(): Promise<void> {
  console.log("Backfill akuntansi: penerimaan material...");
  console.log(`  ${await backfillReceipts()} dokumen diproses.`);
  console.log("Backfill akuntansi: pemakaian material...");
  console.log(`  ${await backfillMaterialIssues()} dokumen diproses.`);
  console.log("Backfill akuntansi: barang jadi...");
  console.log(`  ${await backfillFinishedGoods()} lot diproses.`);
  console.log("Backfill akuntansi: pengiriman...");
  console.log(`  ${await backfillShipments()} dokumen diproses.`);
  await dbSql.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
