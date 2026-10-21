import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * F6.2 — uji negatif keamanan di level API terhadap build produksi:
 * tanpa sesi (401), role tanpa izin (403), payload/kuantitas tidak valid (422),
 * manipulasi ID & item milik dokumen lain, serta anti penggandaan (double submit).
 */

const PASSWORD = "password123";
const SHIPPABLE = ["CONFIRMED", "IN_PRODUCTION", "READY_TO_SHIP", "PARTIALLY_SHIPPED"] as const;

type OrderSummary = { id: string; number: string; status: string };
type OrderItem = { id: string };

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

async function signIn(request: APIRequestContext, email: string) {
  const response = await request.post("/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
  });
  expect(response.ok(), `gagal masuk sebagai ${email}`).toBeTruthy();
}

async function listOrders(request: APIRequestContext): Promise<OrderSummary[]> {
  const response = await request.get("/api/v1/sales-orders?pageSize=100");
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data as OrderSummary[];
}

async function getOrderItems(request: APIRequestContext, orderId: string): Promise<OrderItem[]> {
  const response = await request.get(`/api/v1/sales-orders/${orderId}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.items as OrderItem[];
}

/** SO pertama yang masih boleh dikirim dan punya item (dari data seed). */
async function findShippableOrder(request: APIRequestContext) {
  for (const order of await listOrders(request)) {
    if (!SHIPPABLE.includes(order.status as (typeof SHIPPABLE)[number])) continue;
    const items = await getOrderItems(request, order.id);
    if (items.length > 0) return { order, items };
  }
  throw new Error("Tidak ada sales order yang bisa dikirim di data seed.");
}

/** Lokasi gudang aktif: dari surat jalan (data seed) atau baris barang jadi. */
async function findLocationId(request: APIRequestContext): Promise<string> {
  const list = await request.get("/api/v1/shipments?pageSize=1");
  const shipments = (await list.json()).data as { id: string }[];
  if (shipments.length > 0) {
    const detail = await request.get(`/api/v1/shipments/${shipments[0].id}`);
    return (await detail.json()).data.location.id;
  }
  const fg = await request.get("/api/v1/finished-goods");
  return (await fg.json()).data[0].locationId;
}

test.describe("uji negatif keamanan API", () => {
  test("tanpa sesi semua endpoint data menolak dengan 401", async ({ request }) => {
    const endpoints = [
      "/api/v1/shipments",
      "/api/v1/finished-goods",
      "/api/v1/sales-orders",
      "/api/v1/purchase-orders",
      "/api/v1/production-orders",
      "/api/v1/qc-inspections",
      "/api/v1/material-receipts",
      "/api/v1/inventory/balances",
      "/api/v1/users",
      "/api/v1/audit-logs",
      "/api/v1/reports/export?report=sales-fulfillment",
    ];

    for (const url of endpoints) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(401);
      const body = await response.json();
      expect(Object.keys(body), url).toEqual(["error"]);
      expect(body.error.code, url).toBe("UNAUTHENTICATED");
      expect(body.error.message, url).toBe("Anda belum masuk.");
      // Tidak ada data yang bocor di respons error.
      expect(body.data, url).toBeUndefined();
    }

    const write = await request.post("/api/v1/shipments", { data: {} });
    expect(write.status()).toBe(401);
    expect((await write.json()).error.code).toBe("UNAUTHENTICATED");

    const assistant = await request.post("/api/v1/assistant", {
      data: { messages: [{ role: "user", content: "Halo" }] },
    });
    expect(assistant.status()).toBe(401);
    expect((await assistant.json()).error.code).toBe("UNAUTHENTICATED");
  });

  test("Asisten AI menolak percakapan tidak valid sebelum memanggil model", async ({ request }) => {
    await signIn(request, "admin@garment.local");

    const empty = await request.post("/api/v1/assistant", { data: { messages: [] } });
    expect(empty.status()).toBe(422);
    expect((await empty.json()).error.code).toBe("VALIDATION_ERROR");

    const assistantLast = await request.post("/api/v1/assistant", {
      data: { messages: [{ role: "assistant", content: "Halo" }] },
    });
    expect(assistantLast.status()).toBe(422);
    expect((await assistantLast.json()).error.code).toBe("VALIDATION_ERROR");

    const invalidContext = await request.post("/api/v1/assistant", {
      data: {
        messages: [{ role: "user", content: "Halo" }],
        context: { pathname: "https://contoh.test/sales" },
      },
    });
    expect(invalidContext.status()).toBe(422);
    expect((await invalidContext.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("purchasing tidak dapat membaca/menulis modul pengiriman dan laporan role lain", async ({
    request,
  }) => {
    await signIn(request, "purchasing@garment.local");

    for (const url of ["/api/v1/shipments", "/api/v1/finished-goods"]) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(403);
      const body = await response.json();
      expect(body.error.code, url).toBe("FORBIDDEN");
      expect(body.data, url).toBeUndefined();
    }

    // Guard izin dievaluasi sebelum validasi body: tetap 403 walau body kosong.
    const write = await request.post("/api/v1/shipments", { data: {} });
    expect(write.status()).toBe(403);

    // Laporan role lain (output produksi) juga tertutup.
    const report = await request.get("/api/v1/reports/export?report=production-output");
    expect(report.status()).toBe(403);
  });

  test("QC tidak dapat membuat SPK", async ({ request }) => {
    await signIn(request, "qc@garment.local");
    const createSpk = await request.post("/api/v1/production-orders", { data: {} });
    expect(createSpk.status()).toBe(403);
  });

  test("shipping tidak dapat mengakses data pengguna", async ({ request }) => {
    await signIn(request, "shipping@garment.local");
    const users = await request.get("/api/v1/users");
    expect(users.status()).toBe(403);
    const createUser = await request.post("/api/v1/users", { data: {} });
    expect(createUser.status()).toBe(403);
  });

  test("kuantitas negatif/nol/pecahan dan item kosong ditolak", async ({ request }) => {
    await signIn(request, "shipping@garment.local");
    const { order, items } = await findShippableOrder(request);
    const locationId = await findLocationId(request);
    const base = { salesOrderId: order.id, locationId, shippedAt: isoToday() };

    const cases = [
      { label: "negatif", quantity: -1, expected: "minimal 1" },
      { label: "nol", quantity: 0, expected: "minimal 1" },
      { label: "pecahan", quantity: 1.5, expected: "bilangan bulat" },
    ] as const;

    for (const item of cases) {
      const response = await request.post("/api/v1/shipments", {
        data: { ...base, items: [{ salesOrderItemId: items[0].id, quantity: item.quantity }] },
      });
      expect(response.status(), item.label).toBe(422);
      const body = await response.json();
      expect(body.error.code, item.label).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(body.error.details), item.label).toContain(item.expected);
    }

    // Daftar item kosong juga ditolak validasi.
    const emptyItems = await request.post("/api/v1/shipments", {
      data: { ...base, items: [] },
    });
    expect(emptyItems.status()).toBe(422);
    expect(JSON.stringify((await emptyItems.json()).error.details)).toContain(
      "Tambahkan minimal satu item pengiriman",
    );
  });

  test("kuantitas melebihi sisa pesanan ditolak 409", async ({ request }) => {
    await signIn(request, "shipping@garment.local");
    const { order, items } = await findShippableOrder(request);
    const locationId = await findLocationId(request);

    const response = await request.post("/api/v1/shipments", {
      data: {
        salesOrderId: order.id,
        locationId,
        shippedAt: isoToday(),
        items: [{ salesOrderItemId: items[0].id, quantity: 999_999 }],
      },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("melebihi batas");
  });

  test("manipulasi ID dan item milik dokumen lain ditolak", async ({ request }) => {
    await signIn(request, "shipping@garment.local");

    // ID bukan UUID tidak menghasilkan 500 dan tidak membocorkan detail query.
    const notUuid = await request.get("/api/v1/shipments/id-ngawur");
    expect(notUuid.status()).toBe(404);
    const notUuidBody = await notUuid.json();
    expect(notUuidBody.error.code).toBe("NOT_FOUND");
    expect(notUuidBody.error.message).toBe("Dokumen tidak ditemukan.");

    // UUID yang tidak ada → 404.
    const missing = await request.get("/api/v1/shipments/00000000-0000-4000-8000-000000000000");
    expect(missing.status()).toBe(404);

    // Item milik sales order lain tidak dapat dikirim lewat pesanan ini.
    const { order } = await findShippableOrder(request);
    const other = (await listOrders(request)).find((candidate) => candidate.id !== order.id);
    expect(other).toBeTruthy();
    const otherItems = await getOrderItems(request, other!.id);
    expect(otherItems.length).toBeGreaterThan(0);

    const locationId = await findLocationId(request);
    const response = await request.post("/api/v1/shipments", {
      data: {
        salesOrderId: order.id,
        locationId,
        shippedAt: isoToday(),
        items: [{ salesOrderItemId: otherItems[0].id, quantity: 1 }],
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toContain("bukan milik");
  });

  test("surat jalan yang sudah diposting tidak dapat diposting/dibatalkan dua kali", async ({
    request,
  }) => {
    await signIn(request, "shipping@garment.local");

    const list = await request.get("/api/v1/shipments?status=POSTED&pageSize=1");
    const posted = (await list.json()).data[0] as { id: string } | undefined;
    expect(posted, "data seed harus punya surat jalan berstatus POSTED").toBeTruthy();

    const repost = await request.post(`/api/v1/shipments/${posted!.id}/post`);
    expect(repost.status()).toBe(409);
    const repostBody = await repost.json();
    expect(repostBody.error.code).toBe("CONFLICT");
    expect(repostBody.error.message).toContain("sudah diposting");

    // Pembatalan hanya untuk draf.
    const cancel = await request.post(`/api/v1/shipments/${posted!.id}/cancel`, {
      data: { reason: "Uji E2E" },
    });
    expect(cancel.status()).toBe(409);
  });

  test("transfer dengan idempotencyKey sama tidak menggandakan mutasi stok", async ({
    request,
  }) => {
    await signIn(request, "warehouse@garment.local");

    const balances = (
      await (await request.get("/api/v1/inventory/balances?itemType=MATERIAL&pageSize=100")).json()
    ).data as {
      materialId: string | null;
      quantityOnHand: string;
      locationId: string;
    }[];
    const source = balances.find(
      (row) => row.materialId !== null && Number(row.quantityOnHand) >= 2,
    );
    expect(source, "butuh material dengan stok ≥ 2 di data seed").toBeTruthy();
    const toLocationId = balances
      .map((row) => row.locationId)
      .find((locationId) => locationId !== source!.locationId);
    expect(toLocationId).toBeTruthy();

    async function balanceAt(locationId: string): Promise<number> {
      const response = await request.get(
        `/api/v1/inventory/balances?itemType=MATERIAL&location=${locationId}&pageSize=100`,
      );
      const rows = (await response.json()).data as {
        materialId: string | null;
        quantityOnHand: string;
      }[];
      const row = rows.find((candidate) => candidate.materialId === source!.materialId);
      return row ? Number(row.quantityOnHand) : 0;
    }

    const before = await balanceAt(toLocationId!);
    const payload = {
      itemType: "MATERIAL",
      materialId: source!.materialId,
      fromLocationId: source!.locationId,
      toLocationId,
      quantity: 1,
      idempotencyKey: `e2e-idem-${Date.now()}`,
    };

    const first = await request.post("/api/v1/inventory/transfers", { data: payload });
    expect(first.status()).toBe(201);
    const second = await request.post("/api/v1/inventory/transfers", { data: payload });
    expect(second.status()).toBe(201);

    const firstBody = await first.json();
    const secondBody = await second.json();
    // Permintaan kedua mengembalikan transaksi yang sama tanpa mutasi baru.
    expect(secondBody.data.id).toBe(firstBody.data.id);

    const after = await balanceAt(toLocationId!);
    expect(after - before).toBe(1);
  });
});
