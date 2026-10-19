import { salesOrderStatus, shipmentStatus } from "@/lib/db/schema";

/**
 * Aturan pengiriman & pemenuhan pesanan (PRD FR-10, F5 task 5.3–5.4) — logika
 * murni tanpa DB, dipakai bersama oleh service, form, laporan, dan unit test.
 */

export type ShipmentStatus = (typeof shipmentStatus.enumValues)[number];
export type SalesOrderStatus = (typeof salesOrderStatus.enumValues)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  DRAFT: "Draf",
  POSTED: "Diposting",
  CANCELLED: "Dibatalkan",
};

/** Status SO yang masih boleh menerima alokasi/pengiriman baru. */
export const SHIPPABLE_SO_STATUSES: readonly SalesOrderStatus[] = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "PARTIALLY_SHIPPED",
];

export function canCreateShipmentForOrder(status: SalesOrderStatus): boolean {
  return SHIPPABLE_SO_STATUSES.includes(status);
}

/** Pengiriman hanya dapat dibatalkan selama masih draf. */
export function canCancelShipment(status: ShipmentStatus): boolean {
  return status === "DRAFT";
}

/** Sisa kuantitas pesanan yang belum terkirim. */
export function remainingOrderQuantity(orderedQuantity: number, shippedQuantity: number): number {
  return Math.max(0, orderedQuantity - shippedQuantity);
}

export type SalesOrderItemFulfillment = {
  orderedQuantity: number;
  shippedQuantity: number;
  /** Kuantitas yang dialokasikan (reserved) untuk item ini. */
  allocatedQuantity: number;
};

export type FulfillmentStatusInput = {
  items: readonly SalesOrderItemFulfillment[];
  currentStatus: SalesOrderStatus;
  /** Apakah pesanan pernah/sedang diproduksi (ada SPK non-cancelled). */
  hasProductionOrder: boolean;
};

/**
 * Status SO turunan dari pemenuhan item (F5 task 5.3–5.4):
 * - semua sisa 0 → `COMPLETED`;
 * - sudah ada yang terkirim → `PARTIALLY_SHIPPED`;
 * - semua sisa tertutup alokasi → `READY_TO_SHIP`;
 * - selain itu `null` (status tidak diubah), kecuali status kini `READY_TO_SHIP`
 *   tapi alokasi tidak lagi menutup sisa → kembali ke `IN_PRODUCTION`
 *   (atau `CONFIRMED` bila pesanan belum pernah diproduksi).
 */
export function computeFulfillmentStatus(input: FulfillmentStatusInput): SalesOrderStatus | null {
  if (input.items.length === 0) return null;

  const totalShipped = input.items.reduce((sum, item) => sum + item.shippedQuantity, 0);
  if (input.items.every((item) => item.shippedQuantity >= item.orderedQuantity)) {
    return "COMPLETED";
  }
  if (totalShipped > 0) return "PARTIALLY_SHIPPED";
  if (input.items.every((item) => item.allocatedQuantity >= item.orderedQuantity)) {
    return "READY_TO_SHIP";
  }
  if (input.currentStatus === "READY_TO_SHIP" || input.currentStatus === "PARTIALLY_SHIPPED") {
    return input.hasProductionOrder ? "IN_PRODUCTION" : "CONFIRMED";
  }
  return null;
}

/**
 * Batas kuantitas aman untuk satu baris pengiriman: tidak melebihi sisa
 * pesanan dan tidak melebihi barang jadi yang tersedia di lokasi (termasuk
 * alokasi milik item ini, yang dilepas saat posting).
 */
export function maxShippableQuantity(input: {
  orderedQuantity: number;
  shippedQuantity: number;
  availableAtLocation: number;
  /** Alokasi (reserved) item ini di lokasi pengiriman. */
  allocatedToItemAtLocation: number;
}): number {
  const remaining = remainingOrderQuantity(input.orderedQuantity, input.shippedQuantity);
  const available =
    Math.max(0, input.availableAtLocation) + Math.max(0, input.allocatedToItemAtLocation);
  return Math.max(0, Math.min(remaining, available));
}

/** Sisa kuantitas item yang masih perlu dialokasikan agar siap kirim. */
export function unallocatedOrderQuantity(fulfillment: SalesOrderItemFulfillment): number {
  return Math.max(
    0,
    remainingOrderQuantity(fulfillment.orderedQuantity, fulfillment.shippedQuantity) -
      fulfillment.allocatedQuantity,
  );
}

/** Sebuah pesanan siap kirim bila seluruh sisa kuantitasnya sudah dialokasikan. */
export function isFullyAllocated(items: readonly SalesOrderItemFulfillment[]): boolean {
  return (
    items.length > 0 &&
    items.every((item) => item.allocatedQuantity >= item.orderedQuantity - item.shippedQuantity)
  );
}
