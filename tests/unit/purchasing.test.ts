import { describe, expect, it } from "vitest";
import {
  canCancelPurchaseOrder,
  canCancelReceipt,
  canOrderPurchaseOrder,
  canPostReceipt,
  canReceivePurchaseOrder,
  isEditablePurchaseOrderStatus,
  isEditableReceiptStatus,
  resolvePurchaseOrderStatus,
} from "@/modules/purchasing/status";

describe("transisi status purchase order", () => {
  it("hanya draf yang dapat diubah dan dipesan", () => {
    expect(isEditablePurchaseOrderStatus("DRAFT")).toBe(true);
    expect(isEditablePurchaseOrderStatus("ORDERED")).toBe(false);
    expect(canOrderPurchaseOrder("DRAFT")).toBe(true);
    expect(canOrderPurchaseOrder("ORDERED")).toBe(false);
    expect(canOrderPurchaseOrder("CANCELLED")).toBe(false);
  });

  it("penerimaan hanya untuk PO yang sudah dipesan dan belum lengkap", () => {
    expect(canReceivePurchaseOrder("DRAFT")).toBe(false);
    expect(canReceivePurchaseOrder("ORDERED")).toBe(true);
    expect(canReceivePurchaseOrder("PARTIALLY_RECEIVED")).toBe(true);
    expect(canReceivePurchaseOrder("RECEIVED")).toBe(false);
    expect(canReceivePurchaseOrder("CANCELLED")).toBe(false);
  });

  it("pembatalan hanya sebelum ada penerimaan", () => {
    expect(canCancelPurchaseOrder("DRAFT")).toBe(true);
    expect(canCancelPurchaseOrder("ORDERED")).toBe(true);
    expect(canCancelPurchaseOrder("PARTIALLY_RECEIVED")).toBe(false);
    expect(canCancelPurchaseOrder("RECEIVED")).toBe(false);
    expect(canCancelPurchaseOrder("CANCELLED")).toBe(false);
  });
});

describe("resolvePurchaseOrderStatus", () => {
  it("tidak mengubah status bila belum ada penerimaan", () => {
    expect(resolvePurchaseOrderStatus([{ ordered: 10, accepted: 0 }])).toBeNull();
    expect(resolvePurchaseOrderStatus([])).toBeNull();
  });

  it("menghasilkan PARTIALLY_RECEIVED bila baru sebagian", () => {
    expect(
      resolvePurchaseOrderStatus([
        { ordered: 10, accepted: 10 },
        { ordered: 5, accepted: 2 },
      ]),
    ).toBe("PARTIALLY_RECEIVED");
  });

  it("menghasilkan RECEIVED bila semua item terpenuhi (tanpa toleransi)", () => {
    expect(
      resolvePurchaseOrderStatus([
        { ordered: 10, accepted: 10 },
        { ordered: 5, accepted: 5 },
      ]),
    ).toBe("RECEIVED");
  });

  it("tahan galat floating point (0,1 + 0,2 = 0,3)", () => {
    expect(
      resolvePurchaseOrderStatus([{ ordered: 0.3, accepted: 0.1 + 0.2 }]),
    ).toBe("RECEIVED");
  });

  it("tetap PARTIALLY_RECEIVED bila ada satu item kurang meski yang lain lebih", () => {
    expect(
      resolvePurchaseOrderStatus([
        { ordered: 10, accepted: 12 },
        { ordered: 5, accepted: 4.9999 },
      ]),
    ).toBe("PARTIALLY_RECEIVED");
  });
});

describe("transisi status penerimaan", () => {
  it("hanya draf yang dapat diubah, diposting, dan dibatalkan", () => {
    expect(isEditableReceiptStatus("DRAFT")).toBe(true);
    expect(isEditableReceiptStatus("POSTED")).toBe(false);
    expect(canPostReceipt("DRAFT")).toBe(true);
    expect(canPostReceipt("POSTED")).toBe(false);
    expect(canCancelReceipt("DRAFT")).toBe(true);
    expect(canCancelReceipt("POSTED")).toBe(false);
    expect(canCancelReceipt("CANCELLED")).toBe(false);
  });
});
