import { describe, expect, it } from "vitest";
import {
  FINAL_SO_STATUSES,
  SO_STATUS_LABELS,
  canCancelSo,
  canConfirmSo,
  isActiveSoStatus,
  isEditableSoStatus,
  type SalesOrderStatus,
} from "@/modules/sales-order/status";
import { salesOrderFormSchema } from "@/modules/sales-order/schemas";

const ALL_STATUSES = Object.keys(SO_STATUS_LABELS) as SalesOrderStatus[];
const VARIANT_A = "11111111-1111-4111-8111-111111111111";
const VARIANT_B = "22222222-2222-4222-8222-222222222222";
const BUYER = "33333333-3333-4333-8333-333333333333";

describe("transisi status sales order", () => {
  it("hanya draf yang dapat diubah", () => {
    for (const status of ALL_STATUSES) {
      expect(isEditableSoStatus(status)).toBe(status === "DRAFT");
    }
  });

  it("hanya draf yang dapat dikonfirmasi", () => {
    for (const status of ALL_STATUSES) {
      expect(canConfirmSo(status)).toBe(status === "DRAFT");
    }
  });

  it("pembatalan hanya sebelum produksi (draf / dikonfirmasi)", () => {
    for (const status of ALL_STATUSES) {
      expect(canCancelSo(status)).toBe(status === "DRAFT" || status === "CONFIRMED");
    }
  });

  it("status final bukan pesanan aktif", () => {
    expect(FINAL_SO_STATUSES).toEqual(["CANCELLED", "COMPLETED"]);
    for (const status of ALL_STATUSES) {
      expect(isActiveSoStatus(status)).toBe(!FINAL_SO_STATUSES.includes(status));
    }
  });

  it("setiap status punya label Bahasa Indonesia", () => {
    expect(ALL_STATUSES).toHaveLength(7);
    for (const status of ALL_STATUSES) {
      expect(SO_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});

describe("validasi form sales order", () => {
  const base = {
    buyerId: BUYER,
    orderDate: "2026-03-01",
    dueDate: "2026-03-15",
    items: [{ variantId: VARIANT_A, quantity: 10, unitPrice: 50_000 }],
  };

  it("menerima pesanan valid", () => {
    expect(salesOrderFormSchema.safeParse(base).success).toBe(true);
  });

  it("menolak tenggat sebelum tanggal pesanan", () => {
    const result = salesOrderFormSchema.safeParse({ ...base, dueDate: "2026-02-28" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("dueDate"))).toBe(true);
    }
  });

  it("menolak daftar item kosong", () => {
    expect(salesOrderFormSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("menolak kuantitas nol atau pecahan", () => {
    const zero = salesOrderFormSchema.safeParse({
      ...base,
      items: [{ variantId: VARIANT_A, quantity: 0, unitPrice: 0 }],
    });
    const fraction = salesOrderFormSchema.safeParse({
      ...base,
      items: [{ variantId: VARIANT_A, quantity: 1.5, unitPrice: 0 }],
    });
    expect(zero.success).toBe(false);
    expect(fraction.success).toBe(false);
  });

  it("menolak harga satuan negatif", () => {
    const result = salesOrderFormSchema.safeParse({
      ...base,
      items: [{ variantId: VARIANT_A, quantity: 1, unitPrice: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("menolak varian duplikat dalam satu pesanan", () => {
    const result = salesOrderFormSchema.safeParse({
      ...base,
      items: [
        { variantId: VARIANT_A, quantity: 1, unitPrice: 0 },
        { variantId: VARIANT_A, quantity: 2, unitPrice: 0 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("items"))).toBe(true);
    }
  });

  it("menerima dua varian berbeda", () => {
    const result = salesOrderFormSchema.safeParse({
      ...base,
      items: [
        { variantId: VARIANT_A, quantity: 1, unitPrice: 0 },
        { variantId: VARIANT_B, quantity: 2, unitPrice: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });
});
