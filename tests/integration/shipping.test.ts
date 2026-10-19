import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  auditLogs,
  finishedGoods,
  inventoryBalances,
  inventoryTransactions,
  warehouseLocations,
} from "@/lib/db/schema";
import { createBuyer } from "@/modules/buyer/service";
import { recordFinishedGoodsLot } from "@/modules/finished-goods/service";
import { adjustStock } from "@/modules/inventory/service";
import { addBomItem, activateBom, createBom } from "@/modules/master/bom/service";
import { createMaterial } from "@/modules/master/material/service";
import { createProduct, createVariant } from "@/modules/master/product/service";
import { createLine } from "@/modules/master/production-line/service";
import { createUom } from "@/modules/master/uom/service";
import { createLocation, createWarehouse } from "@/modules/master/warehouse/service";
import {
  getProductionOrderDetail,
  createProductionOrder,
  recordStageOutput,
} from "@/modules/production/service";
import { createQcInspection } from "@/modules/qc/service";
import {
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  getSalesOrderDetail,
} from "@/modules/sales-order/service";
import {
  cancelShipment,
  createAllocation,
  createShipment,
  getSalesOrderFulfillment,
  getShipmentDetail,
  postShipment,
  releaseAllocation,
} from "@/modules/shipping/service";
import { TEST_ACTOR_ID } from "../helpers/constants";

let sequence = 0;
function uniqueName(prefix: string): string {
  sequence += 1;
  return `${prefix} ${sequence}`;
}

async function ensureFinishedGoodsLocation(): Promise<string> {
  const [existing] = await db
    .select({ id: warehouseLocations.id })
    .from(warehouseLocations)
    .where(eq(warehouseLocations.code, "B-01"))
    .limit(1);
  if (existing) return existing.id;

  const warehouse = await createWarehouse(
    { name: uniqueName("Gudang Barang Jadi Uji") },
    TEST_ACTOR_ID,
  );
  const location = await createLocation(
    warehouse.id,
    { code: "B-01", name: "Area Produk Jadi" },
    TEST_ACTOR_ID,
  );
  return location.id;
}

type ShippingFixture = {
  buyerId: string;
  variantId: string;
  salesOrderId: string;
  salesOrderItemId: string;
  productionOrderId: string;
  locationId: string;
  quantity: number;
  packingInspectionId: string;
  packingInspectionNumber: string;
};

async function createShippingFixture(quantity = 30): Promise<ShippingFixture> {
  const locationId = await ensureFinishedGoodsLocation();
  const buyer = await createBuyer({ name: uniqueName("Buyer Kirim") }, TEST_ACTOR_ID);
  const uom = await createUom(
    { code: `PCS${sequence}`, name: uniqueName("Pcs Kirim") },
    TEST_ACTOR_ID,
  );
  const material = await createMaterial(
    { name: uniqueName("Kain Kirim"), unitId: uom.id, minimumStock: 0 },
    TEST_ACTOR_ID,
  );
  const product = await createProduct({ name: uniqueName("Produk Kirim") }, TEST_ACTOR_ID);
  const variant = await createVariant(product.id, { size: "L", color: "Navy" }, TEST_ACTOR_ID);
  const bom = await createBom({ variantId: variant.id, notes: "" }, TEST_ACTOR_ID);
  await addBomItem(
    bom.id,
    { materialId: material.id, quantityPerUnit: 0.5, scrapAllowance: 0, notes: "" },
    TEST_ACTOR_ID,
  );
  await activateBom(bom.id, TEST_ACTOR_ID);
  const line = await createLine({ name: uniqueName("Lini Kirim") }, TEST_ACTOR_ID);

  await adjustStock(
    {
      direction: "IN",
      itemType: "MATERIAL",
      materialId: material.id,
      variantId: "",
      locationId,
      quantity: 200,
      reason: "Stok awal uji pengiriman.",
      notes: "",
    },
    TEST_ACTOR_ID,
  );

  const salesOrder = await createSalesOrder(
    {
      buyerId: buyer.id,
      orderDate: "2026-04-01",
      dueDate: "2026-04-20",
      notes: "",
      items: [
        { variantId: variant.id, quantity, unitPrice: 150_000, dueDate: "", notes: "" },
      ],
    },
    TEST_ACTOR_ID,
  );
  await confirmSalesOrder(salesOrder.id, TEST_ACTOR_ID);
  const orderDetail = await getSalesOrderDetail(salesOrder.id);
  const item = orderDetail.items[0];
  if (!item) throw new Error("Item SO uji tidak terbentuk.");

  const productionOrder = await createProductionOrder(
    {
      salesOrderItemId: item.id,
      plannedQuantity: quantity,
      productionLineId: line.id,
      plannedStartDate: "2026-04-02",
      plannedEndDate: "2026-04-15",
      notes: "",
    },
    TEST_ACTOR_ID,
  );
  const productionDetail = await getProductionOrderDetail(productionOrder.id);

  for (const stageCode of ["CUTTING", "SEWING", "FINISHING", "PACKING"] as const) {
    await recordStageOutput(
      productionOrder.id,
      {
        stageCode,
        processedQuantity: quantity,
        passedQuantity: quantity,
        rejectedQuantity: 0,
        isRework: false,
        notes: "",
      },
      TEST_ACTOR_ID,
    );
  }

  const packing = productionDetail.stages.find((stage) => stage.stageCode === "PACKING");
  if (!packing) throw new Error("Tahap packing tidak terbentuk.");
  const inspection = await createQcInspection(
    {
      productionStageId: packing.id,
      inspectedQuantity: quantity,
      passedQuantity: quantity,
      rejectedQuantity: 0,
      result: "PASS",
      notes: "Lolos QC akhir.",
      defects: [],
    },
    TEST_ACTOR_ID,
  );

  return {
    buyerId: buyer.id,
    variantId: variant.id,
    salesOrderId: salesOrder.id,
    salesOrderItemId: item.id,
    productionOrderId: productionOrder.id,
    locationId,
    quantity,
    packingInspectionId: inspection.id,
    packingInspectionNumber: inspection.number,
  };
}

async function finishedGoodsBalance(variantId: string, locationId: string) {
  const [row] = await db
    .select({ onHand: inventoryBalances.quantityOnHand, reserved: inventoryBalances.quantityReserved })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.itemType, "FINISHED_GOOD"),
        eq(inventoryBalances.variantId, variantId),
        eq(inventoryBalances.locationId, locationId),
      ),
    )
    .limit(1);
  return { onHand: Number(row?.onHand ?? 0), reserved: Number(row?.reserved ?? 0) };
}

describe("barang jadi & pengiriman (integrasi DB)", () => {
  it("QC packing PASS membuat satu lot barang jadi dan penerimaan stok idempoten", async () => {
    const fixture = await createShippingFixture(30);

    const balance = await finishedGoodsBalance(fixture.variantId, fixture.locationId);
    expect(balance).toEqual({ onHand: 30, reserved: 0 });

    const lots = await db
      .select()
      .from(finishedGoods)
      .where(eq(finishedGoods.qcInspectionId, fixture.packingInspectionId));
    expect(lots).toHaveLength(1);
    expect(Number(lots[0]?.quantity)).toBe(30);
    expect(lots[0]?.productionOrderId).toBe(fixture.productionOrderId);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, lots[0]!.id));
    expect(logs.map((log) => log.action)).toContain("finished-goods.receive");

    // Permintaan ulang untuk inspeksi yang sama tidak menggandakan lot/stok.
    await db.transaction(async (tx) => {
      const result = await recordFinishedGoodsLot(tx, {
        productionOrderId: fixture.productionOrderId,
        qcInspectionId: fixture.packingInspectionId,
        variantId: fixture.variantId,
        quantity: 30,
        createdBy: TEST_ACTOR_ID,
        notes: "Duplikat permintaan.",
      });
      expect(result.created).toBe(false);
    });
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 30,
      reserved: 0,
    });

    // Inspeksi PASS tahap lain bukan QC akhir → tidak membuat lot.
    const cutting = (
      await getProductionOrderDetail(fixture.productionOrderId)
    ).stages.find((stage) => stage.stageCode === "CUTTING");
    expect(cutting).toBeDefined();
    const cuttingInspection = await createQcInspection(
      {
        productionStageId: cutting!.id,
        inspectedQuantity: 30,
        passedQuantity: 30,
        rejectedQuantity: 0,
        result: "PASS",
        notes: "",
        defects: [],
      },
      TEST_ACTOR_ID,
    );
    const cuttingLots = await db
      .select()
      .from(finishedGoods)
      .where(eq(finishedGoods.qcInspectionId, cuttingInspection.id));
    expect(cuttingLots).toHaveLength(0);

    const receiptMovements = await db
      .select()
      .from(inventoryTransactions)
      .where(
        and(
          eq(inventoryTransactions.referenceType, "qc-inspection"),
          eq(inventoryTransactions.referenceId, fixture.packingInspectionId),
        ),
      );
    expect(receiptMovements).toHaveLength(1);
    expect(receiptMovements[0]?.transactionType).toBe("RECEIPT");
  });

  it("alokasi mereservasi stok, melepas alokasi, dan menurunkan status SO", async () => {
    const fixture = await createShippingFixture(30);

    const allocation = await createAllocation(
      fixture.salesOrderId,
      {
        salesOrderItemId: fixture.salesOrderItemId,
        locationId: fixture.locationId,
        quantity: 30,
        idempotencyKey: "uji-alokasi-penuh",
      },
      TEST_ACTOR_ID,
    );
    expect(allocation.orderStatus).toBe("READY_TO_SHIP");
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 30,
      reserved: 30,
    });

    const order = await getSalesOrderDetail(fixture.salesOrderId);
    expect(order.order.status).toBe("READY_TO_SHIP");

    await expect(
      createAllocation(
        fixture.salesOrderId,
        {
          salesOrderItemId: fixture.salesOrderItemId,
          locationId: fixture.locationId,
          quantity: 1,
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/dialokasikan penuh/);

    const released = await releaseAllocation(
      fixture.salesOrderId,
      {
        salesOrderItemId: fixture.salesOrderItemId,
        locationId: fixture.locationId,
        quantity: 5,
        reason: "Uji pelepasan",
      },
      TEST_ACTOR_ID,
    );
    expect(released.orderStatus).toBe("IN_PRODUCTION");
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 30,
      reserved: 25,
    });

    await expect(
      releaseAllocation(
        fixture.salesOrderId,
        {
          salesOrderItemId: fixture.salesOrderItemId,
          locationId: fixture.locationId,
          quantity: 30,
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/Hanya 25/);

    const fulfillment = await getSalesOrderFulfillment(fixture.salesOrderId);
    const line = fulfillment.items.find(
      (item) => item.salesOrderItemId === fixture.salesOrderItemId,
    );
    expect(line?.allocatedQuantity).toBe(25);
    expect(line?.unallocatedQuantity).toBe(5);
    expect(line?.availableQuantity).toBe(5);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, fixture.salesOrderId));
    const actions = logs.map((log) => log.action);
    expect(actions).toContain("sales-order.allocate");
    expect(actions).toContain("sales-order.release-allocation");
  });

  it("menjaga batas kirim, memposting stok sekali, dan memperbarui status SO", async () => {
    const fixture = await createShippingFixture(30);

    // Alokasikan 10 agar posting melepas reservasi item ini.
    await createAllocation(
      fixture.salesOrderId,
      {
        salesOrderItemId: fixture.salesOrderItemId,
        locationId: fixture.locationId,
        quantity: 10,
      },
      TEST_ACTOR_ID,
    );

    await expect(
      createShipment(
        {
          salesOrderId: fixture.salesOrderId,
          locationId: fixture.locationId,
          shippedAt: "2026-04-16",
          notes: "",
          items: [{ salesOrderItemId: fixture.salesOrderItemId, quantity: 31 }],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/melebihi batas/);

    await expect(
      createShipment(
        {
          salesOrderId: fixture.salesOrderId,
          locationId: fixture.locationId,
          shippedAt: "2026-04-16",
          notes: "",
          items: [{ salesOrderItemId: fixture.salesOrderItemId, quantity: 0 }],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/minimal 1/);

    const draft = await createShipment(
      {
        salesOrderId: fixture.salesOrderId,
        locationId: fixture.locationId,
        shippedAt: "2026-04-16",
        notes: "Kirim separuh dulu.",
        items: [{ salesOrderItemId: fixture.salesOrderItemId, quantity: 10 }],
      },
      TEST_ACTOR_ID,
    );
    expect(draft.number).toMatch(/^SJ-\d{6}-\d{4}$/);
    expect(draft.status).toBe("DRAFT");

    // Draf belum mengubah stok.
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 30,
      reserved: 10,
    });

    const posted = await postShipment(draft.id, TEST_ACTOR_ID);
    expect(posted.status).toBe("POSTED");
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 20,
      reserved: 0,
    });

    const afterPost = await getSalesOrderDetail(fixture.salesOrderId);
    expect(afterPost.order.status).toBe("PARTIALLY_SHIPPED");
    expect(afterPost.totals.shippedQuantity).toBe(10);

    const detail = await getShipmentDetail(draft.id);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]?.quantity).toBe(10);
    expect(detail.totals.totalQuantity).toBe(10);

    await expect(postShipment(draft.id, TEST_ACTOR_ID)).rejects.toThrow(/sudah diposting/);

    // Sisa 20 unit dapat dikirim penuh → SO selesai.
    const second = await createShipment(
      {
        salesOrderId: fixture.salesOrderId,
        locationId: fixture.locationId,
        shippedAt: "2026-04-17",
        notes: "",
        items: [{ salesOrderItemId: fixture.salesOrderItemId, quantity: 20 }],
      },
      TEST_ACTOR_ID,
    );
    await postShipment(second.id, TEST_ACTOR_ID);

    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 0,
      reserved: 0,
    });
    expect((await getSalesOrderDetail(fixture.salesOrderId)).order.status).toBe("COMPLETED");

    const issueMovements = await db
      .select()
      .from(inventoryTransactions)
      .where(
        and(
          eq(inventoryTransactions.referenceType, "shipment"),
          eq(inventoryTransactions.referenceId, draft.id),
        ),
      );
    expect(issueMovements).toHaveLength(1);
    expect(issueMovements[0]?.transactionType).toBe("ISSUE");
    expect(Number(issueMovements[0]?.quantity)).toBe(10);

    await expect(
      createShipment(
        {
          salesOrderId: fixture.salesOrderId,
          locationId: fixture.locationId,
          shippedAt: "2026-04-18",
          notes: "",
          items: [{ salesOrderItemId: fixture.salesOrderItemId, quantity: 1 }],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/tidak dapat dikirim/);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, draft.id));
    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining(["shipment.create", "shipment.post"]),
    );
  });

  it("membatalkan draf pengiriman tidak menyentuh stok", async () => {
    const fixture = await createShippingFixture(10);

    const draft = await createShipment(
      {
        salesOrderId: fixture.salesOrderId,
        locationId: fixture.locationId,
        shippedAt: "2026-04-16",
        notes: "",
        items: [{ salesOrderItemId: fixture.salesOrderItemId, quantity: 4 }],
      },
      TEST_ACTOR_ID,
    );

    const cancelled = await cancelShipment(
      draft.id,
      { reason: "Jadwal ekspedisi berubah" },
      TEST_ACTOR_ID,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 10,
      reserved: 0,
    });
    expect((await getSalesOrderDetail(fixture.salesOrderId)).order.status).toBe("IN_PRODUCTION");

    await expect(
      cancelShipment(draft.id, { reason: "Batal lagi" }, TEST_ACTOR_ID),
    ).rejects.toThrow(/draf/);
    await expect(postShipment(draft.id, TEST_ACTOR_ID)).rejects.toThrow(/dibatalkan/);

    // Draf baru tetap dapat dibuat setelah pembatalan.
    const replacement = await createShipment(
      {
        salesOrderId: fixture.salesOrderId,
        locationId: fixture.locationId,
        shippedAt: "2026-04-17",
        notes: "",
        items: [{ salesOrderItemId: fixture.salesOrderItemId, quantity: 10 }],
      },
      TEST_ACTOR_ID,
    );
    await postShipment(replacement.id, TEST_ACTOR_ID);
    expect((await getSalesOrderDetail(fixture.salesOrderId)).order.status).toBe("COMPLETED");
  });

  it("pembatalan sales order melepas alokasi barang jadi", async () => {
    const fixture = await createShippingFixture(10);

    const secondOrder = await createSalesOrder(
      {
        buyerId: fixture.buyerId,
        orderDate: "2026-04-02",
        dueDate: "2026-04-25",
        notes: "",
        items: [
          { variantId: fixture.variantId, quantity: 6, unitPrice: 150_000, dueDate: "", notes: "" },
        ],
      },
      TEST_ACTOR_ID,
    );
    await confirmSalesOrder(secondOrder.id, TEST_ACTOR_ID);
    const secondItem = (await getSalesOrderDetail(secondOrder.id)).items[0];
    expect(secondItem).toBeDefined();

    await createAllocation(
      secondOrder.id,
      {
        salesOrderItemId: secondItem!.id,
        locationId: fixture.locationId,
        quantity: 4,
      },
      TEST_ACTOR_ID,
    );
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 10,
      reserved: 4,
    });

    const cancelled = await cancelSalesOrder(
      secondOrder.id,
      { reason: "Buyer membatalkan pesanan" },
      TEST_ACTOR_ID,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(await finishedGoodsBalance(fixture.variantId, fixture.locationId)).toEqual({
      onHand: 10,
      reserved: 0,
    });
  });
});
