import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getDocumentPeriod } from "@/lib/utils/dates";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { createBuyer, listBuyers, updateBuyer } from "@/modules/buyer/service";
import { TEST_ACTOR_ID } from "../helpers/constants";

const ALL = { status: "all", page: 1, pageSize: 50 } as const;

function numberOf(code: string): number {
  return Number(code.split("-").at(-1));
}

describe("service buyer (integrasi DB)", () => {
  it("membuat buyer dengan kode otomatis berurutan", async () => {
    const first = await createBuyer({ name: "PT Alpha Garmen" }, TEST_ACTOR_ID);
    const second = await createBuyer({ name: "CV Beta Konveksi" }, TEST_ACTOR_ID);

    expect(first.code).toMatch(/^BUY-\d{4}$/);
    expect(numberOf(second.code)).toBe(numberOf(first.code) + 1);
    expect(first.isActive).toBe(true);
  });

  it("menulis audit buyer.create di transaksi yang sama", async () => {
    const buyer = await createBuyer({ name: "PT Audit Sejahtera" }, TEST_ACTOR_ID);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "buyer"), eq(auditLogs.entityId, buyer.id)));

    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("buyer.create");
    expect(logs[0]?.actorUserId).toBe(TEST_ACTOR_ID);
  });

  it("menormalkan bidang opsional kosong menjadi null", async () => {
    const buyer = await createBuyer(
      { name: "PT Bidang Kosong", phone: "   ", email: "", contactPerson: "" },
      TEST_ACTOR_ID,
    );

    expect(buyer.phone).toBeNull();
    expect(buyer.email).toBeNull();
    expect(buyer.contactPerson).toBeNull();
  });

  it("update parsial hanya mengubah bidang yang dikirim dan menulis audit", async () => {
    const buyer = await createBuyer(
      { name: "PT Ubah Parsial", phone: "021-000", email: "awal@contoh.id" },
      TEST_ACTOR_ID,
    );

    const updated = await updateBuyer(buyer.id, { phone: "021-999" }, TEST_ACTOR_ID);
    expect(updated.phone).toBe("021-999");
    expect(updated.email).toBe("awal@contoh.id");
    expect(updated.name).toBe("PT Ubah Parsial");

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "buyer"), eq(auditLogs.entityId, buyer.id)));
    expect(logs.map((log) => log.action)).toContain("buyer.update");
  });

  it("perubahan status saja tercatat sebagai buyer.deactivate / buyer.activate", async () => {
    const buyer = await createBuyer({ name: "PT Status Berubah" }, TEST_ACTOR_ID);

    const deactivated = await updateBuyer(buyer.id, { isActive: false }, TEST_ACTOR_ID);
    expect(deactivated.isActive).toBe(false);

    const reactivated = await updateBuyer(buyer.id, { isActive: true }, TEST_ACTOR_ID);
    expect(reactivated.isActive).toBe(true);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "buyer"), eq(auditLogs.entityId, buyer.id)));
    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining(["buyer.deactivate", "buyer.activate"]),
    );
  });

  it("update buyer yang tidak ada melempar 404", async () => {
    await expect(
      updateBuyer("00000000-0000-0000-0000-000000000000", { name: "Hantu" }, TEST_ACTOR_ID),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("list memfilter dengan pencarian dan status", async () => {
    await createBuyer({ name: "PT Zebra Satu" }, TEST_ACTOR_ID);
    await createBuyer({ name: "PT Zebra Dua" }, TEST_ACTOR_ID);
    const zebraTiga = await createBuyer({ name: "PT Zebra Tiga" }, TEST_ACTOR_ID);
    await updateBuyer(zebraTiga.id, { isActive: false }, TEST_ACTOR_ID);

    const search = await listBuyers({ ...ALL, query: "Zebra" });
    expect(search.total).toBe(3);

    const active = await listBuyers({ ...ALL, query: "Zebra", status: "active" });
    expect(active.items.map((buyer) => buyer.name)).toEqual(["PT Zebra Satu", "PT Zebra Dua"]);

    const inactive = await listBuyers({ ...ALL, query: "Zebra", status: "inactive" });
    expect(inactive.items.map((buyer) => buyer.name)).toEqual(["PT Zebra Tiga"]);
  });

  it("list mematuhi paginasi", async () => {
    const page1 = await listBuyers({ status: "all", page: 1, pageSize: 2 });
    const page2 = await listBuyers({ status: "all", page: 2, pageSize: 2 });

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBeGreaterThan(2);
    expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id);
  });
});

describe("nextDocumentNumber (atomik)", () => {
  it("memberi nomor unik saat 10 transaksi paralel", async () => {
    const codes = await Promise.all(
      Array.from({ length: 10 }, () =>
        db.transaction((tx) => nextDocumentNumber(tx, "TEST", { period: null })),
      ),
    );

    const numbers = codes.map(numberOf);
    expect(new Set(numbers).size).toBe(10);
    expect(Math.max(...numbers) - Math.min(...numbers)).toBe(9);
  });

  it("memakai periode bulan Jakarta saat period tidak diberikan", async () => {
    const code = await db.transaction((tx) => nextDocumentNumber(tx, "SO"));
    expect(code).toBe(`SO-${getDocumentPeriod()}-0001`);
  });
});
