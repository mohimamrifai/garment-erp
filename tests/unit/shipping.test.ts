import { describe, expect, it } from "vitest";
import {
  computeAttainmentPercentage,
  computeDefectRate,
} from "@/modules/reports/calc";
import {
  canCancelShipment,
  canCreateShipmentForOrder,
  computeFulfillmentStatus,
  isFullyAllocated,
  maxShippableQuantity,
  remainingOrderQuantity,
  SHIPMENT_STATUS_LABELS,
  unallocatedOrderQuantity,
} from "@/modules/shipping/status";

describe("aturan pengiriman", () => {
  it("hanya pesanan aktif yang dapat dibuatkan pengiriman", () => {
    expect(canCreateShipmentForOrder("CONFIRMED")).toBe(true);
    expect(canCreateShipmentForOrder("IN_PRODUCTION")).toBe(true);
    expect(canCreateShipmentForOrder("READY_TO_SHIP")).toBe(true);
    expect(canCreateShipmentForOrder("PARTIALLY_SHIPPED")).toBe(true);
    expect(canCreateShipmentForOrder("DRAFT")).toBe(false);
    expect(canCreateShipmentForOrder("COMPLETED")).toBe(false);
    expect(canCreateShipmentForOrder("CANCELLED")).toBe(false);
  });

  it("hanya draf yang dapat dibatalkan", () => {
    expect(canCancelShipment("DRAFT")).toBe(true);
    expect(canCancelShipment("POSTED")).toBe(false);
    expect(canCancelShipment("CANCELLED")).toBe(false);
  });

  it("punya label Bahasa Indonesia", () => {
    expect(SHIPMENT_STATUS_LABELS).toEqual({
      DRAFT: "Draf",
      POSTED: "Diposting",
      CANCELLED: "Dibatalkan",
    });
  });

  it("menghitung sisa pesanan tanpa nilai negatif", () => {
    expect(remainingOrderQuantity(30, 10)).toBe(20);
    expect(remainingOrderQuantity(10, 10)).toBe(0);
    expect(remainingOrderQuantity(10, 12)).toBe(0);
  });

  it("membatasi kirim dengan sisa pesanan dan stok yang dapat dipakai", () => {
    expect(
      maxShippableQuantity({
        orderedQuantity: 30,
        shippedQuantity: 10,
        availableAtLocation: 5,
        allocatedToItemAtLocation: 3,
      }),
    ).toBe(8);
    expect(
      maxShippableQuantity({
        orderedQuantity: 30,
        shippedQuantity: 10,
        availableAtLocation: 100,
        allocatedToItemAtLocation: 0,
      }),
    ).toBe(20);
    expect(
      maxShippableQuantity({
        orderedQuantity: 10,
        shippedQuantity: 10,
        availableAtLocation: 100,
        allocatedToItemAtLocation: 100,
      }),
    ).toBe(0);
  });
});

describe("status pemenuhan sales order", () => {
  const base = { currentStatus: "IN_PRODUCTION" as const, hasProductionOrder: true };

  it("selesai bila semua item sudah terkirim", () => {
    expect(
      computeFulfillmentStatus({
        ...base,
        items: [
          { orderedQuantity: 10, shippedQuantity: 10, allocatedQuantity: 0 },
          { orderedQuantity: 5, shippedQuantity: 5, allocatedQuantity: 0 },
        ],
      }),
    ).toBe("COMPLETED");
  });

  it("terkirim sebagian bila sudah ada pengiriman namun belum penuh", () => {
    expect(
      computeFulfillmentStatus({
        ...base,
        items: [
          { orderedQuantity: 10, shippedQuantity: 4, allocatedQuantity: 0 },
          { orderedQuantity: 5, shippedQuantity: 0, allocatedQuantity: 0 },
        ],
      }),
    ).toBe("PARTIALLY_SHIPPED");
  });

  it("siap kirim bila seluruh sisa tertutup alokasi", () => {
    expect(
      computeFulfillmentStatus({
        ...base,
        items: [
          { orderedQuantity: 10, shippedQuantity: 0, allocatedQuantity: 10 },
          { orderedQuantity: 5, shippedQuantity: 0, allocatedQuantity: 5 },
        ],
      }),
    ).toBe("READY_TO_SHIP");
  });

  it("kembali ke produksi bila alokasi tidak lagi menutup sisa", () => {
    expect(
      computeFulfillmentStatus({
        currentStatus: "READY_TO_SHIP",
        hasProductionOrder: true,
        items: [{ orderedQuantity: 10, shippedQuantity: 0, allocatedQuantity: 4 }],
      }),
    ).toBe("IN_PRODUCTION");
    expect(
      computeFulfillmentStatus({
        currentStatus: "READY_TO_SHIP",
        hasProductionOrder: false,
        items: [{ orderedQuantity: 10, shippedQuantity: 0, allocatedQuantity: 4 }],
      }),
    ).toBe("CONFIRMED");
  });

  it("tidak mengubah status lain bila belum ada perubahan pemenuhan", () => {
    expect(
      computeFulfillmentStatus({
        ...base,
        items: [{ orderedQuantity: 10, shippedQuantity: 0, allocatedQuantity: 2 }],
      }),
    ).toBeNull();
  });
});

describe("alokasi item", () => {
  it("menghitung sisa yang belum dialokasikan", () => {
    expect(
      unallocatedOrderQuantity({
        orderedQuantity: 10,
        shippedQuantity: 2,
        allocatedQuantity: 3,
      }),
    ).toBe(5);
    expect(
      unallocatedOrderQuantity({
        orderedQuantity: 10,
        shippedQuantity: 2,
        allocatedQuantity: 8,
      }),
    ).toBe(0);
  });

  it("mendeteksi alokasi penuh untuk seluruh item", () => {
    expect(
      isFullyAllocated([
        { orderedQuantity: 10, shippedQuantity: 0, allocatedQuantity: 10 },
        { orderedQuantity: 5, shippedQuantity: 2, allocatedQuantity: 3 },
      ]),
    ).toBe(true);
    expect(
      isFullyAllocated([{ orderedQuantity: 10, shippedQuantity: 0, allocatedQuantity: 9 }]),
    ).toBe(false);
    expect(isFullyAllocated([])).toBe(false);
  });
});

describe("kalkulasi laporan", () => {
  it("menghitung defect rate dengan aman saat tanpa inspeksi", () => {
    expect(computeDefectRate(200, 5)).toBe(2.5);
    expect(computeDefectRate(3, 1)).toBe(33.33);
    expect(computeDefectRate(0, 0)).toBe(0);
  });

  it("menghitung pencapaian target; null bila target 0", () => {
    expect(computeAttainmentPercentage(100, 80)).toBe(80);
    expect(computeAttainmentPercentage(30, 45)).toBe(150);
    expect(computeAttainmentPercentage(0, 10)).toBeNull();
  });
});
