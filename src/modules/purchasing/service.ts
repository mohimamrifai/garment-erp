/**
 * Service modul pembelian.
 *
 * Implementasi dipecah per tanggung jawab:
 * - `shared`           : tipe, helper kuantitas, guard, dan penguncian
 * - `queries`          : daftar & detail PO/penerimaan, opsi penerimaan
 * - `purchase-orders`  : pembuatan, perubahan, pemesanan, pembatalan PO
 * - `receipts`         : pembuatan, perubahan, posting, pembatalan penerimaan
 * - `dashboard`        : agregasi kartu pembelian di dashboard
 *
 * Invariant:
 * - PO hanya dapat dipesan bila supplier & material aktif.
 * - Penerimaan hanya mengurangi sisa PO saat status POSTED; draf tidak.
 * - Posting penerimaan menambah stok lewat inventory engine, bukan tulis langsung.
 */
export * from "./shared";
export * from "./queries";
export * from "./purchase-orders";
export * from "./receipts";
export * from "./dashboard";
