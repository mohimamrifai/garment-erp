import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditLogs, salesOrders } from "@/lib/db/schema";
import { getDateOffset } from "@/lib/utils/dates";
import { createBuyer, updateBuyer } from "@/modules/buyer/service";
import {
  addBomItem,
  activateBom,
  createBom,
  createBomVersion,
  getBomDetail,
  listBomItems,
  removeBomItem,
} from "@/modules/master/bom/service";
import { createMaterial, updateMaterial } from "@/modules/master/material/service";
import { createProduct, createVariant, updateProduct } from "@/modules/master/product/service";
import { createUom } from "@/modules/master/uom/service";
import {
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  getDashboardSoSummary,
  getSalesOrderDetail,
  listSalesOrders,
  updateSalesOrder,
} from "@/modules/sales-order/service";
import type { SalesOrderFormInput } from "@/modules/sales-order/schemas";
import { TEST_ACTOR_ID } from "../helpers/constants";

const ORDER_DATE = "2026-03-01";
const DUE_DATE = "2026-03-15";

let sequence = 0;
function uniqueName(prefix: string): string {
  sequence += 1;
  return `${prefix} ${sequence}`;
}

async function createBuyerAndVariant() {
  const buyer = await createBuyer({ name: uniqueName("Buyer Uji") }, TEST_ACTOR_ID);
  const product = await createProduct({ name: uniqueName("Produk Uji") }, TEST_ACTOR_ID);
  const variant = await createVariant(product.id, { size: "M", color: "Hitam" }, TEST_ACTOR_ID);
  return { buyer, product, variant };
}

function orderForm(
  buyerId: string,
  items: SalesOrderFormInput["items"],
  overrides: Partial<SalesOrderFormInput> = {},
): SalesOrderFormInput {
  return {
    buyerId,
    orderDate: ORDER_DATE,
    dueDate: DUE_DATE,
    notes: "",
    items,
    ...overrides,
  };
}

describe("service sales order (integrasi DB)", () => {
  it("membuat SO draf dengan nomor bulanan dan item tersalin tenggat pesanan", async () => {
    const { buyer, variant } = await createBuyerAndVariant();

    const order = await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 25, unitPrice: 85_000, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    expect(order.number).toMatch(/^SO-\d{6}-\d{4}$/);
    expect(order.status).toBe("DRAFT");
    expect(order.confirmedAt).toBeNull();

    const detail = await getSalesOrderDetail(order.id);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]?.dueDate).toBe(DUE_DATE);
    expect(detail.totals).toMatchObject({
      itemCount: 1,
      totalQuantity: 25,
      shippedQuantity: 0,
      totalValue: "2125000.00",
    });
  });

  it("menghormati tenggat item khusus bila diisi", async () => {
    const { buyer, variant } = await createBuyerAndVariant();

    const order = await createSalesOrder(
      orderForm(
        buyer.id,
        [{ variantId: variant.id, quantity: 5, unitPrice: 0, dueDate: "2026-03-10", notes: "" }],
        { dueDate: "2026-03-20" },
      ),
      TEST_ACTOR_ID,
    );

    const detail = await getSalesOrderDetail(order.id);
    expect(detail.items[0]?.dueDate).toBe("2026-03-10");
  });

  it("menolak buyer atau varian yang nonaktif", async () => {
    const { buyer, variant } = await createBuyerAndVariant();
    const otherBuyer = await createBuyer({ name: uniqueName("Buyer Off") }, TEST_ACTOR_ID);

    await updateBuyer(otherBuyer.id, { isActive: false }, TEST_ACTOR_ID);
    await expect(
      createSalesOrder(
        orderForm(otherBuyer.id, [
          { variantId: variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 400 });

    // Varian nonaktif: produk (beserta variannya) dinonaktifkan, lalu dicoba dipakai.
    const spare = await createBuyerAndVariant();
    await updateProduct(spare.product.id, { isActive: false }, TEST_ACTOR_ID);
    await expect(
      createSalesOrder(
        orderForm(buyer.id, [
          { variantId: spare.variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("mengonfirmasi SO draf, menulis confirmedAt + audit, dan menolak konfirmasi ulang", async () => {
    const { buyer, variant } = await createBuyerAndVariant();
    const order = await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 10, unitPrice: 1_000, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    const confirmed = await confirmSalesOrder(order.id, TEST_ACTOR_ID);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.confirmedAt).not.toBeNull();

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, order.id));
    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining(["sales-order.create", "sales-order.confirm"]),
    );

    await expect(confirmSalesOrder(order.id, TEST_ACTOR_ID)).rejects.toMatchObject({ status: 409 });
  });

  it("mengubah draf (item diganti utuh) dan menolak ubah setelah dikonfirmasi", async () => {
    const { buyer, variant } = await createBuyerAndVariant();
    const order = await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 10, unitPrice: 1_000, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    await updateSalesOrder(
      order.id,
      orderForm(
        buyer.id,
        [{ variantId: variant.id, quantity: 40, unitPrice: 2_000, dueDate: "", notes: "revisi" }],
        { dueDate: "2026-03-25" },
      ),
      TEST_ACTOR_ID,
    );

    const detail = await getSalesOrderDetail(order.id);
    expect(detail.order.dueDate).toBe("2026-03-25");
    expect(detail.totals.totalQuantity).toBe(40);
    expect(detail.totals.totalValue).toBe("80000.00");
    expect(detail.items[0]?.notes).toBe("revisi");

    await confirmSalesOrder(order.id, TEST_ACTOR_ID);
    await expect(
      updateSalesOrder(
        order.id,
        orderForm(buyer.id, [
          { variantId: variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" },
        ]),
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("membatalkan SO dengan alasan dan menolak pembatalan ganda / setelah produksi", async () => {
    const { buyer, variant } = await createBuyerAndVariant();
    const order = await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 3, unitPrice: 0, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    await confirmSalesOrder(order.id, TEST_ACTOR_ID);

    const cancelled = await cancelSalesOrder(
      order.id,
      { reason: "Buyer mengubah spesifikasi" },
      TEST_ACTOR_ID,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.cancelReason).toBe("Buyer mengubah spesifikasi");

    await expect(
      cancelSalesOrder(order.id, { reason: "Percobaan kedua" }, TEST_ACTOR_ID),
    ).rejects.toMatchObject({ status: 409 });

    // Simulasikan pesanan sudah masuk produksi (status di luar kendali modul SO di F2).
    const other = await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 2, unitPrice: 0, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    await db.update(salesOrders).set({ status: "IN_PRODUCTION" }).where(eq(salesOrders.id, other.id));
    await expect(
      cancelSalesOrder(other.id, { reason: "Tetap ingin batal" }, TEST_ACTOR_ID),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("menolak menonaktifkan buyer yang masih punya SO aktif", async () => {
    const { buyer, variant } = await createBuyerAndVariant();
    await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    await expect(updateBuyer(buyer.id, { isActive: false }, TEST_ACTOR_ID)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("menolak menonaktifkan produk/varian yang dipakai SO terbuka", async () => {
    const { buyer, product, variant } = await createBuyerAndVariant();
    await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );

    await expect(updateProduct(product.id, { isActive: false }, TEST_ACTOR_ID)).rejects.toMatchObject(
      { status: 409 },
    );
  });

  it("list menyaring berdasarkan nomor/buyer dan status", async () => {
    const { buyer, variant } = await createBuyerAndVariant();
    const draft = await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    const confirmed = await createSalesOrder(
      orderForm(buyer.id, [
        { variantId: variant.id, quantity: 2, unitPrice: 0, dueDate: "", notes: "" },
      ]),
      TEST_ACTOR_ID,
    );
    await confirmSalesOrder(confirmed.id, TEST_ACTOR_ID);

    const byNumber = await listSalesOrders({
      query: draft.number,
      status: "all",
      page: 1,
      pageSize: 10,
    });
    expect(byNumber.items.map((row) => row.id)).toEqual([draft.id]);

    const byBuyer = await listSalesOrders({
      query: buyer.name,
      status: "CONFIRMED",
      page: 1,
      pageSize: 10,
    });
    expect(byBuyer.items.map((row) => row.id)).toEqual([confirmed.id]);
    expect(byBuyer.items[0]?.totalQuantity).toBe(2);
  });

  it("ringkasan dashboard menghitung SO aktif dan tenggat terdekat", async () => {
    const { buyer, variant } = await createBuyerAndVariant();

    const overdue = await createSalesOrder(
      orderForm(
        buyer.id,
        [{ variantId: variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" }],
        { orderDate: getDateOffset(-10), dueDate: getDateOffset(-1) },
      ),
      TEST_ACTOR_ID,
    );
    await confirmSalesOrder(overdue.id, TEST_ACTOR_ID);

    const soon = await createSalesOrder(
      orderForm(
        buyer.id,
        [{ variantId: variant.id, quantity: 1, unitPrice: 0, dueDate: "", notes: "" }],
        { orderDate: getDateOffset(-1), dueDate: getDateOffset(3) },
      ),
      TEST_ACTOR_ID,
    );
    expect(soon.status).toBe("DRAFT");

    const summary = await getDashboardSoSummary();
    expect(summary.activeCount).toBeGreaterThanOrEqual(2);
    expect(summary.draftCount).toBeGreaterThanOrEqual(1);
    expect(summary.overdueCount).toBeGreaterThanOrEqual(1);
    expect(summary.dueSoonCount).toBeGreaterThanOrEqual(2);

    // Daftar tenggat terdekat: maksimal 5 baris, urut naik, semuanya ≤ 7 hari.
    expect(summary.dueSoon.length).toBeGreaterThan(0);
    expect(summary.dueSoon.length).toBeLessThanOrEqual(5);
    const dates = summary.dueSoon.map((row) => row.dueDate);
    expect([...dates].sort()).toEqual(dates);
    expect(summary.dueSoon.every((row) => row.dueDate <= getDateOffset(7))).toBe(true);
    expect(summary.dueSoon.map((row) => row.status)).not.toContain("CANCELLED");
  });
});

describe("service BOM (integrasi DB)", () => {
  async function createBomFixture() {
    const product = await createProduct({ name: uniqueName("Produk BOM") }, TEST_ACTOR_ID);
    const variant = await createVariant(product.id, { size: "L", color: "Putih" }, TEST_ACTOR_ID);
    const uom = await createUom({ code: `KG${sequence}`, name: "Kilogram Uji" }, TEST_ACTOR_ID);
    const material = await createMaterial(
      { name: uniqueName("Kain Uji"), unitId: uom.id, minimumStock: 10 },
      TEST_ACTOR_ID,
    );
    return { product, variant, material };
  }

  it("membuat BOM berversi, menolak material ganda, dan mengaktifkan versi terbaru", async () => {
    const { variant, material } = await createBomFixture();

    const first = await createBom({ variantId: variant.id, notes: "" }, TEST_ACTOR_ID);
    expect(first.version).toBe(1);
    expect(first.isActive).toBe(false);

    await addBomItem(
      first.id,
      { materialId: material.id, quantityPerUnit: 0.35, scrapAllowance: 0.02, notes: "" },
      TEST_ACTOR_ID,
    );
    await expect(
      addBomItem(
        first.id,
        { materialId: material.id, quantityPerUnit: 0.1, scrapAllowance: 0, notes: "" },
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });

    const active = await activateBom(first.id, TEST_ACTOR_ID);
    expect(active.isActive).toBe(true);
    expect(active.effectiveUntil).toBeNull();

    // Versi baru menyalin item dan mengnonaktifkan versi lama saat diaktifkan.
    const second = await createBomVersion(first.id, TEST_ACTOR_ID);
    expect(second.version).toBe(2);
    expect(second.isActive).toBe(false);

    await activateBom(second.id, TEST_ACTOR_ID);

    const refreshedFirst = (await getBomDetail(first.id)).bom;
    expect(refreshedFirst.isActive).toBe(false);
    expect(refreshedFirst.effectiveUntil).not.toBeNull();

    const refreshedSecond = (await getBomDetail(second.id)).bom;
    expect(refreshedSecond.isActive).toBe(true);
  });

  it("menolak mengubah item BOM yang sudah aktif dan material yang dipakai BOM aktif", async () => {
    const { variant, material } = await createBomFixture();
    const bom = await createBom({ variantId: variant.id, notes: "" }, TEST_ACTOR_ID);
    await addBomItem(
      bom.id,
      { materialId: material.id, quantityPerUnit: 1, scrapAllowance: 0, notes: "" },
      TEST_ACTOR_ID,
    );
    await activateBom(bom.id, TEST_ACTOR_ID);

    const items = await listBomItems(bom.id);
    await expect(removeBomItem(items[0]!.id, TEST_ACTOR_ID)).rejects.toMatchObject({ status: 409 });

    await expect(updateMaterial(material.id, { isActive: false }, TEST_ACTOR_ID)).rejects.toMatchObject(
      { status: 409 },
    );
  });

  it("menolak mengaktifkan BOM tanpa item", async () => {
    const { variant } = await createBomFixture();
    const bom = await createBom({ variantId: variant.id, notes: "" }, TEST_ACTOR_ID);
    await expect(activateBom(bom.id, TEST_ACTOR_ID)).rejects.toMatchObject({ status: 409 });
  });
});
