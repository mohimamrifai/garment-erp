import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditLogs, inventoryBalances } from "@/lib/db/schema";
import { createMaterial } from "@/modules/master/material/service";
import { createSupplier, updateSupplier } from "@/modules/master/supplier/service";
import { createUom } from "@/modules/master/uom/service";
import { createLocation, createWarehouse } from "@/modules/master/warehouse/service";
import type { MaterialReceiptFormInput, PurchaseOrderFormInput } from "@/modules/purchasing/schemas";
import {
  cancelMaterialReceipt,
  cancelPurchaseOrder,
  createMaterialReceipt,
  createPurchaseOrder,
  getDashboardPurchasingSummary,
  getMaterialReceiptDetail,
  getPurchaseOrderDetail,
  listMaterialReceipts,
  listPurchaseOrders,
  listReceivablePurchaseOrders,
  orderPurchaseOrder,
  postMaterialReceipt,
  updateMaterialReceipt,
  updatePurchaseOrder,
} from "@/modules/purchasing/service";
import { TEST_ACTOR_ID } from "../helpers/constants";

let sequence = 0;
function uniqueName(prefix: string): string {
  sequence += 1;
  return `${prefix} ${sequence}`;
}

async function createFixture() {
  const supplier = await createSupplier({ name: uniqueName("Supplier Uji") }, TEST_ACTOR_ID);
  const uom = await createUom({ code: `MTR${sequence}`, name: uniqueName("Meter Uji") }, TEST_ACTOR_ID);
  const material = await createMaterial(
    { name: uniqueName("Kain PO"), unitId: uom.id, minimumStock: 0 },
    TEST_ACTOR_ID,
  );
  const warehouse = await createWarehouse({ name: uniqueName("Gudang PO") }, TEST_ACTOR_ID);
  const location = await createLocation(warehouse.id, { code: "R-01", name: "Rak Terima" }, TEST_ACTOR_ID);
  return { supplier, material, location };
}

function poForm(
  supplierId: string,
  items: PurchaseOrderFormInput["items"],
  overrides: Partial<PurchaseOrderFormInput> = {},
): PurchaseOrderFormInput {
  return {
    supplierId,
    orderDate: "2026-03-01",
    expectedDate: "2026-03-10",
    notes: "",
    items,
    ...overrides,
  };
}

function receiptForm(
  purchaseOrderId: string,
  locationId: string,
  items: MaterialReceiptFormInput["items"],
  overrides: Partial<MaterialReceiptFormInput> = {},
): MaterialReceiptFormInput {
  return {
    purchaseOrderId,
    receivedAt: "2026-03-08",
    locationId,
    notes: "",
    items,
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

describe("service purchase order (integrasi DB)", () => {
  it("membuat PO draf dengan nomor bulanan, item, dan audit", async () => {
    const { supplier, material } = await createFixture();

    const order = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: 10, unitPrice: 25_000, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    expect(order.number).toMatch(/^PO-\d{6}-\d{4}$/);
    expect(order.status).toBe("DRAFT");

    const detail = await getPurchaseOrderDetail(order.id);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]?.orderedQuantity).toBe("10.0000");
    expect(detail.items[0]?.remainingQuantity).toBe("10.0000");
    expect(detail.totals).toMatchObject({ itemCount: 1, totalOrdered: 10, totalAccepted: 0 });
    expect(detail.totals.totalValue).toBe("250000.00");

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, order.id));
    expect(logs.map((log) => log.action)).toContain("purchase-order.create");
  });

  it("menolak supplier nonaktif dan material nonaktif", async () => {
    const { supplier, material } = await createFixture();
    await updateSupplier(supplier.id, { isActive: false }, TEST_ACTOR_ID);

    await expect(
      createPurchaseOrder(
        poForm(supplier.id, [
          { materialId: material.id, orderedQuantity: 1, unitPrice: 0, notes: "" },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("mengubah draf (item diganti utuh) dan menolak ubah setelah dipesan", async () => {
    const { supplier, material } = await createFixture();
    const order = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: 10, unitPrice: 1_000, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    await updatePurchaseOrder(
      order.id,
      poForm(
        supplier.id,
        [{ materialId: material.id, orderedQuantity: 20, unitPrice: 1_500, notes: "revisi" }],
        { expectedDate: "2026-03-20" },
      ),
      TEST_ACTOR_ID,
    );

    const detail = await getPurchaseOrderDetail(order.id);
    expect(detail.order.expectedDate).toBe("2026-03-20");
    expect(detail.items[0]?.orderedQuantity).toBe("20.0000");
    expect(detail.items[0]?.unitPrice).toBe("1500.00");

    await orderPurchaseOrder(order.id, TEST_ACTOR_ID);
    await expect(
      updatePurchaseOrder(
        order.id,
        poForm(supplier.id, [
          { materialId: material.id, orderedQuantity: 1, unitPrice: 0, notes: "" },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("memesan PO draf (ORDERED + orderedAt) dan menolak pesan ulang", async () => {
    const { supplier, material } = await createFixture();
    const order = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: 5, unitPrice: 100, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    const ordered = await orderPurchaseOrder(order.id, TEST_ACTOR_ID);
    expect(ordered.status).toBe("ORDERED");
    expect(ordered.orderedAt).not.toBeNull();

    await expect(orderPurchaseOrder(order.id, TEST_ACTOR_ID)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("membatalkan PO draf/dipesan dengan alasan; menolak setelah ada penerimaan", async () => {
    const { supplier, material, location } = await createFixture();

    const draft = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: 5, unitPrice: 0, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    const cancelled = await cancelPurchaseOrder(
      draft.id,
      { reason: "Harga supplier naik" },
      TEST_ACTOR_ID,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("Harga supplier naik");

    await expect(orderPurchaseOrder(draft.id, TEST_ACTOR_ID)).rejects.toMatchObject({
      status: 409,
    });

    // PO dengan penerimaan parsial tidak dapat dibatalkan.
    const order = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: 4, unitPrice: 0, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    await orderPurchaseOrder(order.id, TEST_ACTOR_ID);
    const detail = await getPurchaseOrderDetail(order.id);
    const receipt = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        {
          purchaseOrderItemId: detail.items[0]!.id,
          receivedQuantity: 2,
          acceptedQuantity: 2,
          notes: "",
        },
      ]),
      TEST_ACTOR_ID,
    );
    await postMaterialReceipt(receipt.id, TEST_ACTOR_ID);

    await expect(
      cancelPurchaseOrder(order.id, { reason: "Ingin batal" }, TEST_ACTOR_ID),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("list menyaring berdasarkan nomor/supplier dan status", async () => {
    const { supplier, material } = await createFixture();
    const order = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: 1, unitPrice: 0, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    const byNumber = await listPurchaseOrders({
      query: order.number,
      status: "all",
      page: 1,
      pageSize: 10,
    });
    expect(byNumber.items.map((row) => row.id)).toEqual([order.id]);

    const byStatus = await listPurchaseOrders({
      query: supplier.name,
      status: "DRAFT",
      page: 1,
      pageSize: 10,
    });
    expect(byStatus.items.map((row) => row.id)).toContain(order.id);
    expect(byStatus.items[0]?.totalReceived).toBe("0");
  });
});

describe("service material receipt (integrasi DB)", () => {
  async function createOrderedFixture(quantity = 10) {
    const { supplier, material, location } = await createFixture();
    const order = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: quantity, unitPrice: 1_000, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    await orderPurchaseOrder(order.id, TEST_ACTOR_ID);
    const detail = await getPurchaseOrderDetail(order.id);
    return { order, item: detail.items[0]!, material, location };
  }

  it("menolak penerimaan dari PO draf atau yang sudah lengkap", async () => {
    const { supplier, material, location } = await createFixture();
    const draft = await createPurchaseOrder(
      poForm(supplier.id, [
        { materialId: material.id, orderedQuantity: 1, unitPrice: 0, notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    const draftDetail = await getPurchaseOrderDetail(draft.id);
    await expect(
      createMaterialReceipt(
        receiptForm(draft.id, location.id, [
          {
            purchaseOrderItemId: draftDetail.items[0]!.id,
            receivedQuantity: 1,
            acceptedQuantity: 1,
          },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("menerima sebagian → stok naik & status PARTIALLY_RECEIVED; pelunasan → RECEIVED", async () => {
    const { order, item, material, location } = await createOrderedFixture(10);

    const partial = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        { purchaseOrderItemId: item.id, receivedQuantity: 4, acceptedQuantity: 4 },
      ]),
      TEST_ACTOR_ID,
    );
    expect(partial.number).toMatch(/^RCV-\d{6}-\d{4}$/);

    await postMaterialReceipt(partial.id, TEST_ACTOR_ID);

    expect(await stockOf(material.id, location.id)).toBe(4);
    let detail = await getPurchaseOrderDetail(order.id);
    expect(detail.order.status).toBe("PARTIALLY_RECEIVED");
    expect(detail.items[0]?.acceptedQuantity).toBe("4.0000");
    expect(detail.items[0]?.remainingQuantity).toBe("6.0000");

    // Posting ulang ditolak; stok tidak berubah.
    await expect(postMaterialReceipt(partial.id, TEST_ACTOR_ID)).rejects.toMatchObject({
      status: 409,
    });
    expect(await stockOf(material.id, location.id)).toBe(4);

    // Penerimaan kedua melunasi PO.
    const rest = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        { purchaseOrderItemId: item.id, receivedQuantity: 6, acceptedQuantity: 6 },
      ]),
      TEST_ACTOR_ID,
    );
    await postMaterialReceipt(rest.id, TEST_ACTOR_ID);

    expect(await stockOf(material.id, location.id)).toBe(10);
    detail = await getPurchaseOrderDetail(order.id);
    expect(detail.order.status).toBe("RECEIVED");
    expect(detail.receipts.map((r) => r.status)).toEqual(["POSTED", "POSTED"]);

    // PO lengkap tidak bisa menerima lagi.
    await expect(
      createMaterialReceipt(
        receiptForm(order.id, location.id, [
          { purchaseOrderItemId: item.id, receivedQuantity: 1, acceptedQuantity: 1 },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("hanya kuantitas diterima baik yang masuk stok (received > accepted)", async () => {
    const { order, item, material, location } = await createOrderedFixture(10);

    const receipt = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        {
          purchaseOrderItemId: item.id,
          receivedQuantity: 10,
          acceptedQuantity: 7,
          notes: "3 rusak dikembalikan",
        },
      ]),
      TEST_ACTOR_ID,
    );
    await postMaterialReceipt(receipt.id, TEST_ACTOR_ID);

    expect(await stockOf(material.id, location.id)).toBe(7);
    const detail = await getPurchaseOrderDetail(order.id);
    expect(detail.order.status).toBe("PARTIALLY_RECEIVED");
  });

  it("menolak penerimaan melebihi sisa pesanan (tanpa toleransi) dan posting yang bentrok", async () => {
    const { order, item, material, location } = await createOrderedFixture(10);

    // Draf pertama mengambil 8 dari sisa 10.
    const first = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        { purchaseOrderItemId: item.id, receivedQuantity: 8, acceptedQuantity: 8 },
      ]),
      TEST_ACTOR_ID,
    );
    // Draf kedua dibuat saat sisa masih 10 → boleh (draf tidak mengurangi sisa).
    const second = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        { purchaseOrderItemId: item.id, receivedQuantity: 5, acceptedQuantity: 5 },
      ]),
      TEST_ACTOR_ID,
    );
    // Draf ketiga melebihi sisa saat dibuat → ditolak.
    await expect(
      createMaterialReceipt(
        receiptForm(order.id, location.id, [
          { purchaseOrderItemId: item.id, receivedQuantity: 11, acceptedQuantity: 11 },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });

    await postMaterialReceipt(first.id, TEST_ACTOR_ID);
    expect(await stockOf(material.id, location.id)).toBe(8);

    // Draf kedua kini melebihi sisa (2) → posting ditolak, stok tidak berubah.
    await expect(postMaterialReceipt(second.id, TEST_ACTOR_ID)).rejects.toMatchObject({
      status: 409,
    });
    expect(await stockOf(material.id, location.id)).toBe(8);
  });

  it("draf penerimaan dapat diubah; setelah diposting beku (tidak dapat diubah/dibatalkan)", async () => {
    const { order, item, material, location } = await createOrderedFixture(10);

    const receipt = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        { purchaseOrderItemId: item.id, receivedQuantity: 3, acceptedQuantity: 3 },
      ]),
      TEST_ACTOR_ID,
    );

    await updateMaterialReceipt(
      receipt.id,
      receiptForm(
        order.id,
        location.id,
        [{ purchaseOrderItemId: item.id, receivedQuantity: 4, acceptedQuantity: 4 }],
        { notes: "revisi" },
      ),
      TEST_ACTOR_ID,
    );
    expect((await getMaterialReceiptDetail(receipt.id)).receipt.notes).toBe("revisi");

    await postMaterialReceipt(receipt.id, TEST_ACTOR_ID);
    expect(await stockOf(material.id, location.id)).toBe(4);

    await expect(
      updateMaterialReceipt(
        receipt.id,
        receiptForm(order.id, location.id, [
          { purchaseOrderItemId: item.id, receivedQuantity: 1, acceptedQuantity: 1 },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      cancelMaterialReceipt(receipt.id, { reason: "Tidak jadi" }, TEST_ACTOR_ID),
    ).rejects.toMatchObject({ status: 409 });

    // Mutasi tercatat dengan referensi dokumen penerimaan.
    const detail = await getMaterialReceiptDetail(receipt.id);
    expect(detail.transactions).toHaveLength(1);
    expect(detail.transactions[0]?.quantity).toBe("4.0000");
    expect(detail.totals.totalAccepted).toBe(4);
  });

  it("membatalkan draf penerimaan tanpa efek stok", async () => {
    const { order, item, material, location } = await createOrderedFixture(10);

    const receipt = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        { purchaseOrderItemId: item.id, receivedQuantity: 2, acceptedQuantity: 2 },
      ]),
      TEST_ACTOR_ID,
    );
    const cancelled = await cancelMaterialReceipt(
      receipt.id,
      { reason: "Salah input" },
      TEST_ACTOR_ID,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(await stockOf(material.id, location.id)).toBe(0);
  });

  it("list penerimaan menyaring per status dan per PO", async () => {
    const { order, item, location } = await createOrderedFixture(10);
    const receipt = await createMaterialReceipt(
      receiptForm(order.id, location.id, [
        { purchaseOrderItemId: item.id, receivedQuantity: 2, acceptedQuantity: 2 },
      ]),
      TEST_ACTOR_ID,
    );
    await postMaterialReceipt(receipt.id, TEST_ACTOR_ID);

    const list = await listMaterialReceipts({
      query: receipt.number,
      status: "POSTED",
      po: order.id,
      page: 1,
      pageSize: 10,
    });
    expect(list.items.map((row) => row.id)).toEqual([receipt.id]);
    expect(list.items[0]?.purchaseOrderNumber).toBe(order.number);
    expect(list.items[0]?.totalAccepted).toBe("2.0000");
  });

  it("PO terbuka dengan sisa muncul sebagai opsi penerimaan", async () => {
    const { order } = await createOrderedFixture(10);
    const options = await listReceivablePurchaseOrders();
    expect(options.map((row) => row.id)).toContain(order.id);
    expect(Number(options.find((row) => row.id === order.id)?.remainingQuantity)).toBe(10);
  });

  it("ringkasan dashboard pembelian menghitung PO terbuka & tenggat", async () => {
    const { supplier, material } = await createFixture();
    const order = await createPurchaseOrder(
      poForm(
        supplier.id,
        [{ materialId: material.id, orderedQuantity: 10, unitPrice: 0, notes: "" }],
        { expectedDate: "2026-03-02" },
      ),
      TEST_ACTOR_ID,
    );
    await orderPurchaseOrder(order.id, TEST_ACTOR_ID);

    const summary = await getDashboardPurchasingSummary();
    expect(summary.openCount).toBeGreaterThanOrEqual(1);
    expect(summary.draftReceiptCount).toBeGreaterThanOrEqual(0);
    expect(summary.nearest.length).toBeLessThanOrEqual(5);
    expect(summary.nearest.map((row) => row.status)).not.toContain("CANCELLED");
    if (summary.nearest.length > 0) {
      const dates = summary.nearest.map((row) => row.expectedDate ?? "");
      expect([...dates].sort()).toEqual(dates);
    }
  });

  it("penolakan penerimaan melebihi sisa saat draf dibuat", async () => {
    const { order, item, location } = await createOrderedFixture(5);
    await expect(
      createMaterialReceipt(
        receiptForm(order.id, location.id, [
          { purchaseOrderItemId: item.id, receivedQuantity: 6, acceptedQuantity: 6 },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
