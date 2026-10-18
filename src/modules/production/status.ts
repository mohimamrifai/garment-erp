import { productionOrderStatus, productionStageCode, qcResult } from "@/lib/db/schema";

/**
 * Aturan status produksi & QC (PRD FR-08/FR-09, F4 task 4.1–4.7) — logika murni
 * tanpa DB, dipakai bersama oleh service, form, dan unit test.
 */

export type ProductionOrderStatus = (typeof productionOrderStatus.enumValues)[number];
export type ProductionStageCode = (typeof productionStageCode.enumValues)[number];
export type ProductionStageStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type QcResult = (typeof qcResult.enumValues)[number];

export const SPK_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  OPEN: "Terbuka",
  IN_PROGRESS: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const STAGE_CODE_LABELS: Record<ProductionStageCode, string> = {
  CUTTING: "Cutting",
  SEWING: "Sewing",
  FINISHING: "Finishing",
  PACKING: "Packing",
};

export const STAGE_STATUS_LABELS: Record<ProductionStageStatus, string> = {
  PENDING: "Menunggu",
  IN_PROGRESS: "Berjalan",
  COMPLETED: "Selesai",
};

export const QC_RESULT_LABELS: Record<QcResult, string> = {
  PENDING: "Menunggu Keputusan",
  PASS: "Lolos",
  FAIL: "Gagal",
  REWORK: "Rework",
};

/** Urutan tetap empat tahap produksi standar (PRD FR-08). */
export const PRODUCTION_STAGE_FLOW: readonly { code: ProductionStageCode; name: string }[] = [
  { code: "CUTTING", name: STAGE_CODE_LABELS.CUTTING },
  { code: "SEWING", name: STAGE_CODE_LABELS.SEWING },
  { code: "FINISHING", name: STAGE_CODE_LABELS.FINISHING },
  { code: "PACKING", name: STAGE_CODE_LABELS.PACKING },
];

/** Pembatalan SPK hanya selama status masih Terbuka dan belum ada catatan. */
export function canCancelProductionOrder(
  status: ProductionOrderStatus,
  hasRecords: boolean,
): boolean {
  return status === "OPEN" && !hasRecords;
}

/**
 * Kuantitas yang sah diproses sebuah tahap: target untuk tahap pertama,
 * atau total lolos (passed) tahap sebelumnya.
 */
export function inputQuantityForStage(params: {
  sequenceNumber: number;
  targetQuantity: number;
  previousPassedQuantity: number;
}): number {
  return params.sequenceNumber <= 1 ? params.targetQuantity : params.previousPassedQuantity;
}

/** Sisa jatah normal sebuah tahap (belum termasuk rework). */
export function remainingNormalCapacity(params: {
  inputQuantity: number;
  normalProcessedQuantity: number;
}): number {
  return Math.max(0, params.inputQuantity - params.normalProcessedQuantity);
}

/** Sisa jatah rework = kuantitas ditolak inspeksi REWORK − yang sudah diproses ulang. */
export function remainingReworkCapacity(params: {
  reworkRejectedQuantity: number;
  reworkProcessedQuantity: number;
}): number {
  return Math.max(0, params.reworkRejectedQuantity - params.reworkProcessedQuantity);
}

/** Validasi bentuk catatan output tahap; mengembalikan pesan error atau null. */
export function validateStageRecordInput(input: {
  processedQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
}): string | null {
  const { processedQuantity, passedQuantity, rejectedQuantity } = input;
  for (const [label, value] of [
    ["Kuantitas diproses", processedQuantity],
    ["Kuantitas lolos", passedQuantity],
    ["Kuantitas cacat", rejectedQuantity],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      return `${label} harus bilangan bulat dan tidak negatif.`;
    }
  }
  if (processedQuantity <= 0) {
    return "Kuantitas diproses harus lebih dari 0.";
  }
  if (passedQuantity + rejectedQuantity !== processedQuantity) {
    return "Kuantitas lolos + cacat harus sama dengan kuantitas diproses.";
  }
  return null;
}

/** Status tahap dari progress: PENDING (belum ada), IN_PROGRESS, atau COMPLETED. */
export function computeStageStatus(params: {
  inputQuantity: number;
  reworkCapacity: number;
  processedQuantity: number;
  hasRecords: boolean;
}): ProductionStageStatus {
  if (!params.hasRecords) return "PENDING";
  const available = Math.max(0, params.inputQuantity) + Math.max(0, params.reworkCapacity);
  return params.processedQuantity >= available ? "COMPLETED" : "IN_PROGRESS";
}

/** Status SPK turunan dari status keempat tahapnya. */
export function computeProductionOrderStatus(
  stages: readonly { status: ProductionStageStatus }[],
): ProductionOrderStatus {
  if (stages.length === 0) return "OPEN";
  if (stages.every((stage) => stage.status === "COMPLETED")) return "COMPLETED";
  if (stages.every((stage) => stage.status === "PENDING")) return "OPEN";
  return "IN_PROGRESS";
}

/** Validasi kuantitas inspeksi QC (passed + rejected ≤ inspected). */
export function validateQcCounts(input: {
  inspectedQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
}): string | null {
  const { inspectedQuantity, passedQuantity, rejectedQuantity } = input;
  for (const [label, value] of [
    ["Kuantitas diperiksa", inspectedQuantity],
    ["Kuantitas lolos", passedQuantity],
    ["Kuantitas cacat", rejectedQuantity],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      return `${label} harus bilangan bulat dan tidak negatif.`;
    }
  }
  if (inspectedQuantity <= 0) {
    return "Kuantitas diperiksa harus lebih dari 0.";
  }
  if (passedQuantity + rejectedQuantity > inspectedQuantity) {
    return "Kuantitas lolos + cacat tidak boleh melebihi kuantitas diperiksa.";
  }
  return null;
}

/** Sisa kuantitas yang masih dapat diinspeksi pada sebuah tahap. */
export function remainingInspectableQuantity(params: {
  stagePassedQuantity: number;
  alreadyInspectedQuantity: number;
}): number {
  return Math.max(0, params.stagePassedQuantity - params.alreadyInspectedQuantity);
}

/** Sisa kuantitas rework yang masih dapat diperiksa ulang dari inspeksi induk. */
export function remainingReworkInspectableQuantity(params: {
  parentRejectedQuantity: number;
  followedUpQuantity: number;
}): number {
  return Math.max(0, params.parentRejectedQuantity - params.followedUpQuantity);
}

const SCALE = 10_000;

function round4(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

export type MaterialRequirementInput = {
  plannedQuantity: number;
  quantityPerUnit: number;
  scrapAllowance: number;
  /** Stok siap pakai (on hand − reserved). */
  availableQuantity: number;
  /** Penerimaan terjadwal yang dapat diperhitungkan (PO berjalan). */
  scheduledInboundQuantity: number;
};

export type MaterialRequirement = {
  /** Kebutuhan bruto = kuantitas × konsumsi per unit. */
  grossQuantity: number;
  /** Cadangan = kuantitas × cadangan per unit. */
  allowanceQuantity: number;
  /** Kebutuhan bersih = maks(0, bruto + cadangan − tersedia − terjadwal). */
  requiredQuantity: number;
  /** Kekurangan (sama dengan kebutuhan bersih; eksplisit untuk UI). */
  shortageQuantity: number;
};

/** Rumus material planning PRD FR-07 (logika murni, dites di unit test). */
export function computeMaterialRequirement(input: MaterialRequirementInput): MaterialRequirement {
  const gross = round4(input.plannedQuantity * input.quantityPerUnit);
  const allowance = round4(input.plannedQuantity * input.scrapAllowance);
  const available = Math.max(0, input.availableQuantity);
  const scheduled = Math.max(0, input.scheduledInboundQuantity);
  const net = Math.max(0, round4(gross + allowance - available - scheduled));
  return {
    grossQuantity: gross,
    allowanceQuantity: allowance,
    requiredQuantity: net,
    shortageQuantity: net,
  };
}
