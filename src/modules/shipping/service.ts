/**
 * Service modul pengiriman.
 *
 * Implementasi dipecah per tanggung jawab:
 * - `shared`      : helper pemenuhan, alokasi, dan penguncian pesanan
 * - `queries`     : daftar & detail pengiriman, pemenuhan, opsi pesanan
 * - `fulfillment` : penghitungan ulang status SO dari pemenuhan
 * - `allocations` : alokasi & pelepasan barang jadi
 * - `shipments`   : pembuatan, posting, dan pembatalan surat jalan
 *
 * Invariant:
 * - Alokasi dan pengiriman mengunci sales order lebih dulu.
 * - Pengiriman tidak boleh melebihi sisa pesanan maupun stok tersedia.
 * - Semua perubahan stok barang jadi lewat inventory engine.
 */
export * from "./shared";
export * from "./queries";
export * from "./fulfillment";
export * from "./allocations";
export * from "./shipments";
export type { ShipmentStatus } from "./status";
