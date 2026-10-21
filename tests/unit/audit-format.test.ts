import { describe, expect, it } from "vitest";
import {
  formatAuditAction,
  formatAuditDetails,
  formatAuditEntity,
} from "@/modules/audit/format";

describe("format detail audit", () => {
  it("mengembalikan tanda pisah bila detail kosong", () => {
    expect(formatAuditDetails(null)).toBe("—");
    expect(formatAuditDetails({})).toBe("—");
  });

  it("memakai label Indonesia dan pemisah yang konsisten", () => {
    expect(
      formatAuditDetails({ number: "SJ-202610-0001", itemCount: 2, location: "Gudang Jadi / FG-01" }),
    ).toBe("Nomor: SJ-202610-0001 · Jumlah item: 2 · Lokasi: Gudang Jadi / FG-01");
  });

  it("menerjemahkan kode role menjadi nama role", () => {
    expect(formatAuditDetails({ roleCodes: ["ADMIN", "SALES"] })).toBe(
      "Role: Administrator, Sales",
    );
  });

  it("meringkas objek perubahan bertingkat", () => {
    expect(formatAuditDetails({ changes: { name: "PT Baru", phone: "021-555" } })).toBe(
      "Perubahan: Nama: PT Baru; Telepon: 021-555",
    );
  });

  it("menerjemahkan nilai enum dan boolean", () => {
    expect(
      formatAuditDetails({ orderStatus: "PARTIALLY_SHIPPED", isRework: false }),
    ).toBe("Status pesanan: Terkirim Sebagian · Rework: Tidak");
    expect(formatAuditDetails({ stageCode: "CUTTING", result: "PASS" })).toBe(
      "Tahap: Cutting · Hasil: Lolos",
    );
  });

  it("membuat label ramah untuk kunci yang belum dipetakan", () => {
    expect(formatAuditDetails({ deliveryNote: "Catatan" })).toBe(
      "Catatan pengiriman: Catatan",
    );
  });
});

describe("format aksi dan entitas audit", () => {
  it("memakai label aksi yang dikenal", () => {
    expect(formatAuditAction("shipment.post")).toBe("Posting pengiriman");
    expect(formatAuditAction("sales-order.allocate")).toBe("Alokasi barang jadi");
  });

  it("memakai label entitas yang dikenal", () => {
    expect(formatAuditEntity("production-order")).toBe("SPK");
    expect(formatAuditEntity("warehouse-location")).toBe("Lokasi gudang");
  });

  it("memakai fallback yang tetap terbaca untuk kode baru", () => {
    expect(formatAuditAction("buyer.archive")).toBe("Buyer archive");
    expect(formatAuditEntity("buyer-group")).toBe("Buyer group");
  });
});
