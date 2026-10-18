import { salesOrderStatus } from "@/lib/db/schema";

/** Status dokumen Sales Order (turunan enum DB `sales_order_status`). */
export type SalesOrderStatus = (typeof salesOrderStatus.enumValues)[number];

/** Label Bahasa Indonesia untuk dropdown, badge, dan tabel. */
export const SO_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "Draf",
  CONFIRMED: "Dikonfirmasi",
  IN_PRODUCTION: "Dalam Produksi",
  READY_TO_SHIP: "Siap Kirim",
  PARTIALLY_SHIPPED: "Terkirim Sebagian",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

/** Status final (riwayat) — tidak lagi dihitung sebagai pesanan aktif. */
export const FINAL_SO_STATUSES: SalesOrderStatus[] = ["CANCELLED", "COMPLETED"];

/** Hanya draf yang boleh diubah datanya (buyer, tanggal, item). */
export function isEditableSoStatus(status: SalesOrderStatus): boolean {
  return status === "DRAFT";
}

/** Draf → Dikonfirmasi. Status setelahnya dikelola modul produksi/pengiriman. */
export function canConfirmSo(status: SalesOrderStatus): boolean {
  return status === "DRAFT";
}

/** Pembatalan hanya sebelum produksi dimulai; wajib dengan alasan. */
export function canCancelSo(status: SalesOrderStatus): boolean {
  return status === "DRAFT" || status === "CONFIRMED";
}

/** Pesanan aktif = belum final (dipakai kartu dashboard). */
export function isActiveSoStatus(status: SalesOrderStatus): boolean {
  return !FINAL_SO_STATUSES.includes(status);
}
