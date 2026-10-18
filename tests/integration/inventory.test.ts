import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { inventoryBalances, inventoryTransactions } from "@/lib/db/schema";
import { createMaterial } from "@/modules/master/material/service";
import { createUom } from "@/modules/master/uom/service";
import {
  createLocation,
  createWarehouse,
} from "@/modules/master/warehouse/service";
import { postMovement } from "@/modules/inventory/engine";
import {
  adjustStock,
  getDashboardInventorySummary,
  listInventoryBalances,
  listInventoryTransactions,
  transferStock,
} from "@/modules/inventory/service";
import { TEST_ACTOR_ID } from "../helpers/constants";

let sequence = 0;
function uniqueName(prefix: string): string {
  sequence += 1;
  return `${prefix} ${sequence}`;
}

async function createFixture() {
  const uom = await createUom({ code: `KG${sequence}`, name: uniqueName("Kilogram Uji") }, TEST_ACTOR_ID);
  const material = await createMaterial(
    { name: uniqueName("Kain Uji"), unitId: uom.id, minimumStock: 5 },
    TEST_ACTOR_ID,
  );
  const warehouse = await createWarehouse({ name: uniqueName("Gudang Uji") }, TEST_ACTOR_ID);
  const locA = await createLocation(warehouse.id, { code: "A-01", name: "Rak A" }, TEST_ACTOR_ID);
  const locB = await createLocation(warehouse.id, { code: "B-01", name: "Rak B" }, TEST_ACTOR_ID);
  return { material, locA, locB };
}

async function getBalance(materialId: string, locationId: string) {
  const [row] = await db
    .select()
    .from(inventoryBalances)
    .where(and(eq(inventoryBalances.materialId, materialId), eq(inventoryBalances.locationId, locationId)))
    .limit(1);
  return row;
}

async function countTransactions(materialId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(inventoryTransactions)
    .where(eq(inventoryTransactions.materialId, materialId));
  return row?.value ?? 0;
}

function receipt(materialId: string, locationId: string, quantity: number, idempotencyKey?: string) {
  return db.transaction((tx) =>
    postMovement(tx, {
      itemType: "MATERIAL",
      materialId,
      transactionType: "RECEIPT",
      quantity,
      toLocationId: locationId,
      idempotencyKey,
      postedBy: TEST_ACTOR_ID,
    }),
  );
}

function issue(materialId: string, locationId: string, quantity: number) {
  return db.transaction((tx) =>
    postMovement(tx, {
      itemType: "MATERIAL",
      materialId,
      transactionType: "ISSUE",
      quantity,
      fromLocationId: locationId,
      postedBy: TEST_ACTOR_ID,
    }),
  );
}

describe("inventory engine (integrasi DB)", () => {
  it("receipt menambah stok, membuat baris saldo, dan mencatat nomor TRX", async () => {
    const { material, locA } = await createFixture();

    const result = await receipt(material.id, locA.id, 12.5);
    expect(result.applied).toBe(true);
    expect(result.transaction.number).toMatch(/^TRX-\d{6}-\d{4}$/);
    expect(result.transaction.transactionType).toBe("RECEIPT");

    const balance = await getBalance(material.id, locA.id);
    expect(balance?.quantityOnHand).toBe("12.5000");
    expect(balance?.quantityReserved).toBe("0.0000");
  });

  it("issue mengurangi stok dan menolak saldo kurang tanpa jejak transaksi", async () => {
    const { material, locA } = await createFixture();
    await receipt(material.id, locA.id, 10);

    await issue(material.id, locA.id, 4);
    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("6.0000");

    await expect(issue(material.id, locA.id, 7)).rejects.toMatchObject({ status: 409 });
    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("6.0000");
    // receipt + issue sukses = 2; percobaan gagal tidak boleh tercatat.
    expect(await countTransactions(material.id)).toBe(2);
  });

  it("issue tidak boleh mengambil stok yang sedang direservasi", async () => {
    const { material, locA } = await createFixture();
    await receipt(material.id, locA.id, 10);

    await db.transaction((tx) =>
      postMovement(tx, {
        itemType: "MATERIAL",
        materialId: material.id,
        transactionType: "RESERVE",
        quantity: 4,
        fromLocationId: locA.id,
        postedBy: TEST_ACTOR_ID,
      }),
    );
    expect((await getBalance(material.id, locA.id))?.quantityReserved).toBe("4.0000");

    await expect(issue(material.id, locA.id, 7)).rejects.toMatchObject({ status: 409 });
    await issue(material.id, locA.id, 6);
    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("4.0000");

    // Lepas reservasi lalu stok dapat diambil kembali.
    await db.transaction((tx) =>
      postMovement(tx, {
        itemType: "MATERIAL",
        materialId: material.id,
        transactionType: "UNRESERVE",
        quantity: 4,
        fromLocationId: locA.id,
        postedBy: TEST_ACTOR_ID,
      }),
    );
    await issue(material.id, locA.id, 4);
    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("0.0000");
  });

  it("transfer atomik dua sisi; sisi gudang asal divalidasi", async () => {
    const { material, locA, locB } = await createFixture();
    await receipt(material.id, locA.id, 8);

    const result = await db.transaction((tx) =>
      postMovement(tx, {
        itemType: "MATERIAL",
        materialId: material.id,
        transactionType: "TRANSFER",
        quantity: 5,
        fromLocationId: locA.id,
        toLocationId: locB.id,
        postedBy: TEST_ACTOR_ID,
      }),
    );
    expect(result.transaction.fromLocationId).toBe(locA.id);
    expect(result.transaction.toLocationId).toBe(locB.id);

    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("3.0000");
    expect((await getBalance(material.id, locB.id))?.quantityOnHand).toBe("5.0000");

    // Transfer berikutnya melebihi saldo asal → kedua sisi tidak berubah.
    await expect(
      db.transaction((tx) =>
        postMovement(tx, {
          itemType: "MATERIAL",
          materialId: material.id,
          transactionType: "TRANSFER",
          quantity: 99,
          fromLocationId: locA.id,
          toLocationId: locB.id,
          postedBy: TEST_ACTOR_ID,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("3.0000");
    expect((await getBalance(material.id, locB.id))?.quantityOnHand).toBe("5.0000");
  });

  it("request berulang dengan idempotency key tidak menggandakan stok", async () => {
    const { material, locA } = await createFixture();
    const key = `test-receipt-${material.id}`;

    const first = await receipt(material.id, locA.id, 7, key);
    const second = await receipt(material.id, locA.id, 7, key);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.transaction.id).toBe(first.transaction.id);
    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("7.0000");
    expect(await countTransactions(material.id)).toBe(1);
  });

  it("penyesuaian tercatat dengan alasan; saldo tetap tidak bisa negatif di DB", async () => {
    const { material, locA } = await createFixture();
    await receipt(material.id, locA.id, 3);

    const transaction = await adjustStock(
      {
        direction: "OUT",
        itemType: "MATERIAL",
        materialId: material.id,
        locationId: locA.id,
        quantity: 1,
        reason: "Susut penyimpanan",
      },
      TEST_ACTOR_ID,
    );
    expect(transaction.transactionType).toBe("ADJUSTMENT_OUT");
    expect(transaction.notes).toBe("Susut penyimpanan");
    expect((await getBalance(material.id, locA.id))?.quantityOnHand).toBe("2.0000");

    await expect(
      adjustStock(
        {
          direction: "OUT",
          itemType: "MATERIAL",
          materialId: material.id,
          locationId: locA.id,
          quantity: 99,
          reason: "Salah catat",
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 409 });

    // Backstop DB: update langsung ke negatif ditolak CHECK constraint.
    const balance = await getBalance(material.id, locA.id);
    await expect(
      db.update(inventoryBalances).set({ quantityOnHand: "-1" }).where(eq(inventoryBalances.id, balance!.id)),
    ).rejects.toThrow();
  });
});

describe("service inventory (integrasi DB)", () => {
  it("transfer lewat service menulis audit dan menolak lokasi nonaktif / sama", async () => {
    const { material, locA, locB } = await createFixture();
    await receipt(material.id, locA.id, 5);

    const transaction = await transferStock(
      {
        itemType: "MATERIAL",
        materialId: material.id,
        fromLocationId: locA.id,
        toLocationId: locB.id,
        quantity: 2,
        notes: "Pindah rak",
      },
      TEST_ACTOR_ID,
    );
    expect(transaction.referenceType).toBe("manual-transfer");
    expect((await getBalance(material.id, locB.id))?.quantityOnHand).toBe("2.0000");

    await expect(
      transferStock(
        {
          itemType: "MATERIAL",
          materialId: material.id,
          fromLocationId: locA.id,
          toLocationId: locA.id,
          quantity: 1,
        },
        TEST_ACTOR_ID,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("daftar saldo & mutasi membaca data dengan filter", async () => {
    const { material, locA } = await createFixture();
    await receipt(material.id, locA.id, 2); // di bawah minimum (5) → low stock

    const balances = await listInventoryBalances({
      query: material.name,
      warehouse: "",
      location: locA.id,
      itemType: "MATERIAL",
      low: "all",
      page: 1,
      pageSize: 20,
    });
    expect(balances.items).toHaveLength(1);
    expect(balances.items[0]?.quantityOnHand).toBe("2.0000");
    expect(balances.items[0]?.locationCode).toBe("A-01");

    const lowOnly = await listInventoryBalances({
      query: material.name,
      warehouse: "",
      location: "",
      itemType: "MATERIAL",
      low: "1",
      page: 1,
      pageSize: 20,
    });
    expect(lowOnly.items.map((row) => row.materialId)).toContain(material.id);

    const transactions = await listInventoryTransactions({
      query: material.name,
      type: "RECEIPT",
      itemType: "MATERIAL",
      location: locA.id,
      from: "",
      to: "",
      page: 1,
      pageSize: 20,
    });
    expect(transactions.items).toHaveLength(1);
    expect(transactions.items[0]?.transactionType).toBe("RECEIPT");
    expect(transactions.items[0]?.toLocationLabel).toContain("A-01");

    const summary = await getDashboardInventorySummary();
    expect(summary.lowStockCount).toBeGreaterThanOrEqual(1);
  });
});
