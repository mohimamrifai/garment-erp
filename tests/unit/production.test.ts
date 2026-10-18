import { describe, expect, it } from "vitest";
import {
  QC_RESULT_LABELS,
  SPK_STATUS_LABELS,
  STAGE_CODE_LABELS,
  canCancelProductionOrder,
  computeMaterialRequirement,
  computeProductionOrderStatus,
  computeStageStatus,
  inputQuantityForStage,
  PRODUCTION_STAGE_FLOW,
  remainingInspectableQuantity,
  remainingNormalCapacity,
  remainingReworkCapacity,
  remainingReworkInspectableQuantity,
  validateQcCounts,
  validateStageRecordInput,
} from "@/modules/production/status";

describe("label & alur produksi", () => {
  it("punya label Bahasa Indonesia untuk status SPK, tahap, dan hasil QC", () => {
    expect(SPK_STATUS_LABELS.IN_PROGRESS).toBe("Berjalan");
    expect(STAGE_CODE_LABELS.PACKING).toBe("Packing");
    expect(QC_RESULT_LABELS.REWORK).toBe("Rework");
  });

  it("menyusun alur empat tahap standar secara berurutan", () => {
    expect(PRODUCTION_STAGE_FLOW.map((stage) => stage.code)).toEqual([
      "CUTTING",
      "SEWING",
      "FINISHING",
      "PACKING",
    ]);
  });
});

describe("pembatalan SPK", () => {
  it("boleh saat masih Terbuka dan belum ada catatan", () => {
    expect(canCancelProductionOrder("OPEN", false)).toBe(true);
  });

  it("menolak saat sudah berjalan, selesai, dibatalkan, atau ada catatan", () => {
    expect(canCancelProductionOrder("IN_PROGRESS", false)).toBe(false);
    expect(canCancelProductionOrder("COMPLETED", false)).toBe(false);
    expect(canCancelProductionOrder("CANCELLED", false)).toBe(false);
    expect(canCancelProductionOrder("OPEN", true)).toBe(false);
  });
});

describe("kapasitas tahap", () => {
  it("tahap pertama memakai target, tahap berikutnya memakai output lolos sebelumnya", () => {
    expect(
      inputQuantityForStage({ sequenceNumber: 1, targetQuantity: 120, previousPassedQuantity: 0 }),
    ).toBe(120);
    expect(
      inputQuantityForStage({ sequenceNumber: 2, targetQuantity: 120, previousPassedQuantity: 115 }),
    ).toBe(115);
  });

  it("sisa normal = input − yang sudah diproses normal (tidak negatif)", () => {
    expect(remainingNormalCapacity({ inputQuantity: 120, normalProcessedQuantity: 40 })).toBe(80);
    expect(remainingNormalCapacity({ inputQuantity: 120, normalProcessedQuantity: 130 })).toBe(0);
  });

  it("sisa rework = ditolak inspeksi REWORK − yang sudah diproses ulang", () => {
    expect(remainingReworkCapacity({ reworkRejectedQuantity: 5, reworkProcessedQuantity: 2 })).toBe(
      3,
    );
    expect(remainingReworkCapacity({ reworkRejectedQuantity: 5, reworkProcessedQuantity: 5 })).toBe(
      0,
    );
  });

  it("memvalidasi bentuk catatan output tahap", () => {
    expect(
      validateStageRecordInput({ processedQuantity: 10, passedQuantity: 9, rejectedQuantity: 1 }),
    ).toBeNull();
    expect(
      validateStageRecordInput({ processedQuantity: 0, passedQuantity: 0, rejectedQuantity: 0 }),
    ).toMatch(/lebih dari 0/);
    expect(
      validateStageRecordInput({ processedQuantity: 10, passedQuantity: 8, rejectedQuantity: 1 }),
    ).toMatch(/sama dengan kuantitas diproses/);
    expect(
      validateStageRecordInput({ processedQuantity: 10, passedQuantity: -1, rejectedQuantity: 11 }),
    ).toMatch(/bilangan bulat/);
  });
});

describe("status tahap & SPK", () => {
  it("tahap tanpa catatan berstatus Menunggu", () => {
    expect(
      computeStageStatus({
        inputQuantity: 100,
        reworkCapacity: 0,
        processedQuantity: 0,
        hasRecords: false,
      }),
    ).toBe("PENDING");
  });

  it("tahap selesai bila seluruh jatah normal + rework sudah diproses", () => {
    expect(
      computeStageStatus({
        inputQuantity: 100,
        reworkCapacity: 0,
        processedQuantity: 100,
        hasRecords: true,
      }),
    ).toBe("COMPLETED");
    // Rework menambah jatah: 100 normal + 3 rework harus dihabiskan.
    expect(
      computeStageStatus({
        inputQuantity: 100,
        reworkCapacity: 3,
        processedQuantity: 101,
        hasRecords: true,
      }),
    ).toBe("IN_PROGRESS");
    expect(
      computeStageStatus({
        inputQuantity: 100,
        reworkCapacity: 3,
        processedQuantity: 103,
        hasRecords: true,
      }),
    ).toBe("COMPLETED");
  });

  it("status SPK turunan: semua Menunggu = Terbuka, semua Selesai = Selesai, sisanya Berjalan", () => {
    expect(
      computeProductionOrderStatus([
        { status: "PENDING" },
        { status: "PENDING" },
        { status: "PENDING" },
        { status: "PENDING" },
      ]),
    ).toBe("OPEN");
    expect(
      computeProductionOrderStatus([
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "COMPLETED" },
      ]),
    ).toBe("COMPLETED");
    expect(
      computeProductionOrderStatus([
        { status: "COMPLETED" },
        { status: "IN_PROGRESS" },
        { status: "PENDING" },
        { status: "PENDING" },
      ]),
    ).toBe("IN_PROGRESS");
    expect(computeProductionOrderStatus([])).toBe("OPEN");
  });
});

describe("kebutuhan material (FR-07)", () => {
  it("menghitung bruto, cadangan, dan kebutuhan bersih sesuai rumus PRD", () => {
    const result = computeMaterialRequirement({
      plannedQuantity: 120,
      quantityPerUnit: 0.35,
      scrapAllowance: 0.02,
      availableQuantity: 10,
      scheduledInboundQuantity: 25,
    });
    expect(result.grossQuantity).toBe(42);
    expect(result.allowanceQuantity).toBe(2.4);
    expect(result.requiredQuantity).toBe(9.4);
    expect(result.shortageQuantity).toBe(9.4);
  });

  it("kebutuhan bersih nol bila stok + terjadwal menutupi kebutuhan", () => {
    const result = computeMaterialRequirement({
      plannedQuantity: 50,
      quantityPerUnit: 1,
      scrapAllowance: 0,
      availableQuantity: 60,
      scheduledInboundQuantity: 0,
    });
    expect(result.grossQuantity).toBe(50);
    expect(result.requiredQuantity).toBe(0);
    expect(result.shortageQuantity).toBe(0);
  });

  it("tidak pernah negatif walau stok lebih dari kebutuhan", () => {
    const result = computeMaterialRequirement({
      plannedQuantity: 10,
      quantityPerUnit: 0.1,
      scrapAllowance: 0,
      availableQuantity: 999,
      scheduledInboundQuantity: 5,
    });
    expect(result.requiredQuantity).toBe(0);
  });
});

describe("batas inspeksi QC (FR-09)", () => {
  it("inspeksi pertama dibatasi output lolos tahap", () => {
    expect(remainingInspectableQuantity({ stagePassedQuantity: 100, alreadyInspectedQuantity: 30 })).toBe(
      70,
    );
    expect(remainingInspectableQuantity({ stagePassedQuantity: 100, alreadyInspectedQuantity: 100 })).toBe(
      0,
    );
  });

  it("inspeksi ulang dibatasi kuantitas ditolak inspeksi induk (tanpa penggandaan)", () => {
    expect(
      remainingReworkInspectableQuantity({
        parentRejectedQuantity: 5,
        followedUpQuantity: 0,
      }),
    ).toBe(5);
    expect(
      remainingReworkInspectableQuantity({
        parentRejectedQuantity: 5,
        followedUpQuantity: 5,
      }),
    ).toBe(0);
    expect(
      remainingReworkInspectableQuantity({
        parentRejectedQuantity: 5,
        followedUpQuantity: 3,
      }),
    ).toBe(2);
  });

  it("memvalidasi kuantitas inspeksi", () => {
    expect(
      validateQcCounts({ inspectedQuantity: 10, passedQuantity: 8, rejectedQuantity: 2 }),
    ).toBeNull();
    expect(
      validateQcCounts({ inspectedQuantity: 10, passedQuantity: 9, rejectedQuantity: 2 }),
    ).toMatch(/melebihi/);
    expect(
      validateQcCounts({ inspectedQuantity: 0, passedQuantity: 0, rejectedQuantity: 0 }),
    ).toMatch(/lebih dari 0/);
    expect(
      validateQcCounts({ inspectedQuantity: 10, passedQuantity: 1.5, rejectedQuantity: 0 }),
    ).toMatch(/bilangan bulat/);
  });
});
