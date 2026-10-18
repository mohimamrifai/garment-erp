import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditLogs, inventoryBalances, inventoryTransactions } from "@/lib/db/schema";
import { createBuyer } from "@/modules/buyer/service";
import { adjustStock } from "@/modules/inventory/service";
import { addBomItem, activateBom, createBom } from "@/modules/master/bom/service";
import { createMaterial } from "@/modules/master/material/service";
import { createProduct, createVariant } from "@/modules/master/product/service";
import { createLine } from "@/modules/master/production-line/service";
import { createUom } from "@/modules/master/uom/service";
import { createLocation, createWarehouse } from "@/modules/master/warehouse/service";
import type { CreateProductionOrderInput } from "@/modules/production/schemas";
import {
  cancelProductionOrder,
  createProductionOrder,
  getProductionOrderDetail,
  issueMaterials,
  listInspectableStages,
  recordStageOutput,
} from "@/modules/production/service";
import { createQcInspection } from "@/modules/qc/service";
import { confirmSalesOrder, createSalesOrder, getSalesOrderDetail } from "@/modules/sales-order/service";
import { TEST_ACTOR_ID } from "../helpers/constants";

let sequence = 0;
function uniqueName(prefix: string): string {
  sequence += 1;
  return `${prefix} ${sequence}`;
}

type FixtureOptions = {
  quantity?: number;
  stock?: number;
  withBom?: boolean;
};

async function createFixture(options: FixtureOptions = {}) {
  const { quantity = 20, stock = 0, withBom = true } = options;

  const buyer = await createBuyer({ name: uniqueName("Buyer Produksi") }, TEST_ACTOR_ID);
  const uom = await createUom(
    { code: `PCS${sequence}`, name: uniqueName("Pcs Uji") },
    TEST_ACTOR_ID,
  );
  const material = await createMaterial(
    { name: uniqueName("Kain Produksi"), unitId: uom.id, minimumStock: 0 },
    TEST_ACTOR_ID,
  );
  const product = await createProduct({ name: uniqueName("Produk Produksi") }, TEST_ACTOR_ID);
  const variant = await createVariant(product.id, { size: "M", color: "Hitam" }, TEST_ACTOR_ID);

  if (withBom) {
    const bom = await createBom({ variantId: variant.id, notes: "" }, TEST_ACTOR_ID);
    await addBomItem(
      bom.id,
      { materialId: material.id, quantityPerUnit: 0.5, scrapAllowance: 0.02, notes: "" },
      TEST_ACTOR_ID,
    );
    await activateBom(bom.id, TEST_ACTOR_ID);
  }

  const warehouse = await createWarehouse({ name: uniqueName("Gudang Produksi") }, TEST_ACTOR_ID);
  const location = await createLocation(
    warehouse.id,
    { code: `L-${sequence}`, name: "Rak Produksi" },
    TEST_ACTOR_ID,
  );
  const line = await createLine({ name: uniqueName("Lini Produksi") }, TEST_ACTOR_ID);

  const salesOrder = await createSalesOrder(
    {
      buyerId: buyer.id,
      orderDate: "2026-03-01",
      dueDate: "2026-03-20",
      notes: "",
      items: [{ variantId: variant.id, quantity, unitPrice: 100_000, dueDate: "", notes: "" }],
    },
    TEST_ACTOR_ID,
  );
  const orderDetail = await getSalesOrderDetail(salesOrder.id);
  const item = orderDetail.items[0];
  if (!item) throw new Error("Item SO uji tidak terbentuk.");

  if (stock > 0) {
    await adjustStock(
      {
        direction: "IN",
        itemType: "MATERIAL",
        materialId: material.id,
        variantId: "",
        locationId: location.id,
        quantity: stock,
        reason: "Stok awal uji produksi.",
        notes: "",
      },
      TEST_ACTOR_ID,
    );
  }

  return { buyer, material, variant, salesOrder, item, location, line };
}

function spkForm(
  salesOrderItemId: string,
  productionLineId: string,
  overrides: Partial<CreateProductionOrderInput> = {},
): CreateProductionOrderInput {
  return {
    salesOrderItemId,
    plannedQuantity: 10,
    productionLineId,
    plannedStartDate: "2026-03-02",
    plannedEndDate: "2026-03-12",
    notes: "",
    ...overrides,
  };
}

async function stockOf(materialId: string, locationId: string): Promise<number> {
  const [row] = await db
    .select({ quantityOnHand: inventoryBalances.quantityOnHand })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.materialId, materialId),
        eq(inventoryBalances.locationId, locationId),
      ),
    )
    .limit(1);
  return Number(row?.quantityOnHand ?? 0);
}

describe("service produksi (integrasi DB)", () => {
  it("membuat SPK dengan empat tahap, mengunci BOM, dan memindahkan SO ke Dalam Produksi", async () => {
    const fixture = await createFixture({ quantity: 20, stock: 50 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);

    const order = await createProductionOrder(
      spkForm(fixture.item.id, fixture.line.id, { plannedQuantity: 15 }),
      TEST_ACTOR_ID,
    );

    expect(order.number).toMatch(/^SPK-\d{6}-\d{4}$/);
    expect(order.status).toBe("OPEN");
    expect(order.bomId).not.toBeNull();

    const detail = await getProductionOrderDetail(order.id);
    expect(detail.stages.map((stage) => stage.stageCode)).toEqual([
      "CUTTING",
      "SEWING",
      "FINISHING",
      "PACKING",
    ]);
    expect(detail.stages.every((stage) => stage.targetQuantity === 15)).toBe(true);
    expect(detail.stages.every((stage) => stage.status === "PENDING")).toBe(true);
    expect(detail.salesOrder.status).toBe("IN_PRODUCTION");

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, order.id));
    expect(logs.map((log) => log.action)).toContain("production.create");
  });

  it("menolak SPK melebihi sisa item dan SO yang belum dikonfirmasi", async () => {
    const fixture = await createFixture({ quantity: 20, stock: 50 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);

    await createProductionOrder(
      spkForm(fixture.item.id, fixture.line.id, { plannedQuantity: 15 }),
      TEST_ACTOR_ID,
    );

    await expect(
      createProductionOrder(
        spkForm(fixture.item.id, fixture.line.id, { plannedQuantity: 10 }),
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/hanya 5/);

    // SO masih draf → SPK ditolak.
    const draftBuyer = await createBuyer({ name: uniqueName("Buyer Draf") }, TEST_ACTOR_ID);
    const draftOrder = await createSalesOrder(
      {
        buyerId: draftBuyer.id,
        orderDate: "2026-03-01",
        dueDate: "2026-03-20",
        notes: "",
        items: [
          { variantId: fixture.variant.id, quantity: 5, unitPrice: 0, dueDate: "", notes: "" },
        ],
      },
      TEST_ACTOR_ID,
    );
    const draftDetail = await getSalesOrderDetail(draftOrder.id);
    const draftItem = draftDetail.items[0];
    expect(draftItem).toBeDefined();

    await expect(
      createProductionOrder(spkForm(draftItem!.id, fixture.line.id), TEST_ACTOR_ID),
    ).rejects.toThrow(/dikonfirmasi/);
  });

  it("menolak varian tanpa BOM aktif", async () => {
    const withoutBom = await createFixture({ quantity: 10, stock: 0, withBom: false });
    await confirmSalesOrder(withoutBom.salesOrder.id, TEST_ACTOR_ID);

    await expect(
      createProductionOrder(spkForm(withoutBom.item.id, withoutBom.line.id), TEST_ACTOR_ID),
    ).rejects.toThrow(/BOM aktif/);
  });

  it("gate ketersediaan menolak material kurang, kecuali ada alasan tetap dijalankan", async () => {
    const fixture = await createFixture({ quantity: 10, stock: 0 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);

    await expect(
      createProductionOrder(spkForm(fixture.item.id, fixture.line.id), TEST_ACTOR_ID),
    ).rejects.toThrow(/Ketersediaan material kurang/);

    const override = await createProductionOrder(
      spkForm(fixture.item.id, fixture.line.id, {
        shortageReason: "Kain menyusul dari PO berjalan.",
      }),
      TEST_ACTOR_ID,
    );
    expect(override.shortageReason).toBe("Kain menyusul dari PO berjalan.");
  });

  it("mencatat output tahap dengan batas kuantitas dari tahap sebelumnya", async () => {
    const fixture = await createFixture({ quantity: 20, stock: 50 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);
    const order = await createProductionOrder(spkForm(fixture.item.id, fixture.line.id), TEST_ACTOR_ID);

    // Bentuk catatan harus konsisten: lolos + cacat = diproses.
    await expect(
      recordStageOutput(
        order.id,
        {
          stageCode: "CUTTING",
          processedQuantity: 10,
          passedQuantity: 9,
          rejectedQuantity: 0,
          isRework: false,
          notes: "",
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/sama dengan kuantitas diproses/);

    const result = await recordStageOutput(
      order.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 10,
        passedQuantity: 9,
        rejectedQuantity: 1,
        isRework: false,
        notes: "Satu unit cacat potong.",
      },
      TEST_ACTOR_ID,
    );
    expect(result.stage.status).toBe("COMPLETED");
    expect(result.order.status).toBe("IN_PROGRESS");

    // Tahap jahit hanya menerima output lolos cutting (9 unit).
    await expect(
      recordStageOutput(
        order.id,
        {
          stageCode: "SEWING",
          processedQuantity: 10,
          passedQuantity: 10,
          rejectedQuantity: 0,
          isRework: false,
          notes: "",
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/maksimum 9/);

    const sewing = await recordStageOutput(
      order.id,
      {
        stageCode: "SEWING",
        processedQuantity: 9,
        passedQuantity: 9,
        rejectedQuantity: 0,
        isRework: false,
        notes: "",
      },
      TEST_ACTOR_ID,
    );
    expect(sewing.stage.status).toBe("COMPLETED");
  });

  it("alur rework QC tidak menghitung ganda", async () => {
    const fixture = await createFixture({ quantity: 10, stock: 50 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);
    const order = await createProductionOrder(spkForm(fixture.item.id, fixture.line.id), TEST_ACTOR_ID);
    const cutting = (await getProductionOrderDetail(order.id)).stages.find(
      (stage) => stage.stageCode === "CUTTING",
    );
    expect(cutting).toBeDefined();

    await recordStageOutput(
      order.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 10,
        passedQuantity: 9,
        rejectedQuantity: 1,
        isRework: false,
        notes: "",
      },
      TEST_ACTOR_ID,
    );

    const reworkInspection = await createQcInspection(
      {
        productionStageId: cutting!.id,
        inspectedQuantity: 9,
        passedQuantity: 8,
        rejectedQuantity: 1,
        result: "REWORK",
        notes: "",
        defects: [
          { defectCode: "CUT-01", defectName: "Potongan miring", quantity: 1, disposition: "Rework" },
        ],
      },
      TEST_ACTOR_ID,
    );

    // Inspeksi REWORK menambah jatah rework tahap: 10 normal + 1 rework.
    const reworkRecord = await recordStageOutput(
      order.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 1,
        passedQuantity: 1,
        rejectedQuantity: 0,
        isRework: true,
        notes: "Potongan diperbaiki.",
      },
      TEST_ACTOR_ID,
    );
    expect(reworkRecord.stage.status).toBe("COMPLETED");

    // Jatah rework habis — catatan rework tambahan ditolak.
    await expect(
      recordStageOutput(
        order.id,
        {
          stageCode: "CUTTING",
          processedQuantity: 1,
          passedQuantity: 1,
          rejectedQuantity: 0,
          isRework: true,
          notes: "",
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/jatah rework/);

    // Inspeksi ulang dibatasi kuantitas ditolak inspeksi induk.
    await createQcInspection(
      {
        productionStageId: cutting!.id,
        parentInspectionId: reworkInspection.id,
        inspectedQuantity: 1,
        passedQuantity: 1,
        rejectedQuantity: 0,
        result: "PASS",
        notes: "",
        defects: [],
      },
      TEST_ACTOR_ID,
    );

    await expect(
      createQcInspection(
        {
          productionStageId: cutting!.id,
          parentInspectionId: reworkInspection.id,
          inspectedQuantity: 1,
          passedQuantity: 1,
          rejectedQuantity: 0,
          result: "PASS",
          notes: "",
          defects: [],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/inspeksi induk/);
  });

  it("membatasi inspeksi QC pada output tahap dan jumlah rincian cacat", async () => {
    const fixture = await createFixture({ quantity: 20, stock: 50 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);
    const order = await createProductionOrder(spkForm(fixture.item.id, fixture.line.id), TEST_ACTOR_ID);
    const cutting = (await getProductionOrderDetail(order.id)).stages.find(
      (stage) => stage.stageCode === "CUTTING",
    );

    await recordStageOutput(
      order.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 10,
        passedQuantity: 9,
        rejectedQuantity: 1,
        isRework: false,
        notes: "",
      },
      TEST_ACTOR_ID,
    );

    // Melebihi output lolos tahap.
    await expect(
      createQcInspection(
        {
          productionStageId: cutting!.id,
          inspectedQuantity: 10,
          passedQuantity: 9,
          rejectedQuantity: 1,
          result: "REWORK",
          notes: "",
          defects: [],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/dapat diperiksa/);

    await createQcInspection(
      {
        productionStageId: cutting!.id,
        inspectedQuantity: 9,
        passedQuantity: 9,
        rejectedQuantity: 0,
        result: "PENDING",
        notes: "Menunggu keputusan supervisor.",
        defects: [],
      },
      TEST_ACTOR_ID,
    );

    // Sudah diperiksa semua — inspeksi top-level berikutnya ditolak.
    await expect(
      createQcInspection(
        {
          productionStageId: cutting!.id,
          inspectedQuantity: 1,
          passedQuantity: 1,
          rejectedQuantity: 0,
          result: "PASS",
          notes: "",
          defects: [],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/dapat diperiksa/);

    // Hasil Rework wajib punya kuantitas cacat > 0.
    await expect(
      createQcInspection(
        {
          productionStageId: cutting!.id,
          inspectedQuantity: 1,
          passedQuantity: 1,
          rejectedQuantity: 0,
          result: "REWORK",
          notes: "",
          defects: [],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/Rework/);

    const secondOrder = await createProductionOrder(
      spkForm(fixture.item.id, fixture.line.id),
      TEST_ACTOR_ID,
    );
    const secondCutting = (await getProductionOrderDetail(secondOrder.id)).stages.find(
      (stage) => stage.stageCode === "CUTTING",
    );
    await recordStageOutput(
      secondOrder.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 10,
        passedQuantity: 7,
        rejectedQuantity: 3,
        isRework: false,
        notes: "",
      },
      TEST_ACTOR_ID,
    );

    await expect(
      createQcInspection(
        {
          productionStageId: secondCutting!.id,
          inspectedQuantity: 7,
          passedQuantity: 3,
          rejectedQuantity: 4,
          result: "REWORK",
          notes: "",
          defects: [
            { defectCode: "D-01", defectName: "Jahitan loncat", quantity: 3, disposition: "" },
            { defectCode: "D-02", defectName: "Noda", quantity: 2, disposition: "" },
          ],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/melebihi kuantitas ditolak/);
  });

  it("mencatat pemakaian material lewat inventory engine dan idempoten", async () => {
    const fixture = await createFixture({ quantity: 10, stock: 50 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);
    const order = await createProductionOrder(spkForm(fixture.item.id, fixture.line.id), TEST_ACTOR_ID);

    const payload = {
      locationId: fixture.location.id,
      issuedAt: "2026-03-03",
      notes: "Pemakaian uji.",
      idempotencyKey: "uji-pemakaian-produksi",
      items: [{ materialId: fixture.material.id, quantity: 5.2, notes: "" }],
    };

    const issue = await issueMaterials(order.id, payload, TEST_ACTOR_ID);
    expect(issue.number).toMatch(/^MIS-\d{6}-\d{4}$/);
    expect(await stockOf(fixture.material.id, fixture.location.id)).toBeCloseTo(44.8);

    // Klik ulang dengan kunci yang sama tidak menggandakan stok keluar.
    const repeated = await issueMaterials(order.id, payload, TEST_ACTOR_ID);
    expect(repeated.id).toBe(issue.id);
    expect(await stockOf(fixture.material.id, fixture.location.id)).toBeCloseTo(44.8);

    const movements = await db
      .select()
      .from(inventoryTransactions)
      .where(
        and(
          eq(inventoryTransactions.referenceType, "material-issue"),
          eq(inventoryTransactions.referenceId, issue.id),
        ),
      );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.transactionType).toBe("ISSUE");

    // Stok tidak cukup → ditolak tanpa efek samping.
    await expect(
      issueMaterials(
        order.id,
        {
          ...payload,
          idempotencyKey: "uji-pemakaian-gagal",
          items: [{ materialId: fixture.material.id, quantity: 1000, notes: "" }],
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toThrow(/tidak cukup/);
    expect(await stockOf(fixture.material.id, fixture.location.id)).toBeCloseTo(44.8);
  });

  it("membatalkan SPK mengembalikan SO ke Terkonfirmasi bila tidak ada SPK lain", async () => {
    // Skenario 1: satu-satunya SPK dibatalkan → SO kembali Terkonfirmasi.
    const solo = await createFixture({ quantity: 10, stock: 50 });
    await confirmSalesOrder(solo.salesOrder.id, TEST_ACTOR_ID);
    const soloOrder = await createProductionOrder(
      spkForm(solo.item.id, solo.line.id),
      TEST_ACTOR_ID,
    );
    const cancelled = await cancelProductionOrder(
      soloOrder.id,
      { reason: "Buyer menunda pesanan" },
      TEST_ACTOR_ID,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("Buyer menunda pesanan");

    const soloDetail = await getProductionOrderDetail(soloOrder.id);
    expect(soloDetail.salesOrder.status).toBe("CONFIRMED");

    // Tidak ada catatan produksi → pembatalan kedua ditolak karena status bukan Terbuka.
    await expect(
      cancelProductionOrder(soloOrder.id, { reason: "Batal lagi" }, TEST_ACTOR_ID),
    ).rejects.toThrow(/tidak dapat dibatalkan/);

    // Skenario 2: SPK dengan catatan tidak dapat dibatalkan; SO tetap Dalam Produksi
    // selama masih ada SPK aktif lain.
    const pair = await createFixture({ quantity: 20, stock: 50 });
    await confirmSalesOrder(pair.salesOrder.id, TEST_ACTOR_ID);
    const activeOrder = await createProductionOrder(
      spkForm(pair.item.id, pair.line.id),
      TEST_ACTOR_ID,
    );
    await recordStageOutput(
      activeOrder.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 10,
        passedQuantity: 10,
        rejectedQuantity: 0,
        isRework: false,
        notes: "",
      },
      TEST_ACTOR_ID,
    );
    await expect(
      cancelProductionOrder(activeOrder.id, { reason: "Batal uji" }, TEST_ACTOR_ID),
    ).rejects.toThrow(/catatan produksi/);

    const secondOrder = await createProductionOrder(
      spkForm(pair.item.id, pair.line.id),
      TEST_ACTOR_ID,
    );
    await cancelProductionOrder(secondOrder.id, { reason: "Dibatalkan uji" }, TEST_ACTOR_ID);

    const pairDetail = await getProductionOrderDetail(activeOrder.id);
    expect(pairDetail.salesOrder.status).toBe("IN_PRODUCTION");
  });

  it("mendaftar tahap yang dapat diinspeksi berikut sisa kuantitasnya", async () => {
    const fixture = await createFixture({ quantity: 10, stock: 50 });
    await confirmSalesOrder(fixture.salesOrder.id, TEST_ACTOR_ID);
    const order = await createProductionOrder(spkForm(fixture.item.id, fixture.line.id), TEST_ACTOR_ID);

    await recordStageOutput(
      order.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 10,
        passedQuantity: 10,
        rejectedQuantity: 0,
        isRework: false,
        notes: "",
      },
      TEST_ACTOR_ID,
    );

    const stages = await listInspectableStages();
    const target = stages.find((stage) => stage.productionOrderNumber === order.number);
    expect(target).toBeDefined();
    expect(target?.stageCode).toBe("CUTTING");
    expect(target?.inspectableQuantity).toBe(10);
  });
});
