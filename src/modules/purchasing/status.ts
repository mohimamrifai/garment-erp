import { materialReceiptStatus, purchaseOrderStatus } from "@/lib/db/schema";

/**
 * Aturan status dokumen purchasing (PRD FR-05, F3 task 3.3–3.4) — logika murni,
 * terpisah dari service agar mudah diuji tanpa DB.
 */

export type PurchaseOrderStatus = (typeof purchaseOrderStatus.enumValues)[number];
export type MaterialReceiptStatus = (typeof materialReceiptStatus.enumValues)[number];

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draf",
  ORDERED: "Dipesan",
  PARTIALLY_RECEIVED: "Diterima Sebagian",
  RECEIVED: "Diterima Lengkap",
  CANCELLED: "Dibatalkan",
};

export const RECEIPT_STATUS_LABELS: Record<MaterialReceiptStatus, string> = {
  DRAFT: "Draf",
  POSTED: "Diposting",
  CANCELLED: "Dibatalkan",
};

/** PO yang masih berjalan: barang belum diterima lengkap. */
export const OPEN_PO_STATUSES: PurchaseOrderStatus[] = ["ORDERED", "PARTIALLY_RECEIVED"];

/** Hanya draf yang boleh diubah datanya (supplier, tanggal, item). */
export function isEditablePurchaseOrderStatus(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT";
}

/** Draf → Dipesan (baru setelah ini penerimaan diperbolehkan). */
export function canOrderPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT";
}

/** PO berjalan boleh diterima barangnya (parsial diperbolehkan). */
export function canReceivePurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "ORDERED" || status === "PARTIALLY_RECEIVED";
}

/** Batal hanya sebelum ada penerimaan; wajib dengan alasan. */
export function canCancelPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT" || status === "ORDERED";
}

export type PurchaseOrderItemProgress = {
  /** Kuantitas dipesan. */
  ordered: number;
  /** Kuantitas diterima baik dari penerimaan yang sudah diposting. */
  accepted: number;
};

function toScaled(value: number): number {
  return Math.round(value * 10_000);
}

/**
 * Status PO berikutnya berdasarkan progres penerimaan, atau `null` bila belum
 * ada penerimaan (status tidak berubah). Tanpa toleransi: diterima > dipesan
 * tidak pernah dihasilkan karena guard dilakukan sebelum posting.
 */
export function resolvePurchaseOrderStatus(
  items: readonly PurchaseOrderItemProgress[],
): "RECEIVED" | "PARTIALLY_RECEIVED" | null {
  if (items.length === 0) return null;
  const hasProgress = items.some((item) => toScaled(item.accepted) > 0);
  if (!hasProgress) return null;
  const allReceived = items.every(
    (item) => toScaled(item.accepted) >= toScaled(item.ordered),
  );
  return allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
}

/** Penerimaan hanya bisa diubah/dibatalkan selama masih draf. */
export function isEditableReceiptStatus(status: MaterialReceiptStatus): boolean {
  return status === "DRAFT";
}

export function canPostReceipt(status: MaterialReceiptStatus): boolean {
  return status === "DRAFT";
}

export function canCancelReceipt(status: MaterialReceiptStatus): boolean {
  return status === "DRAFT";
}
