import { inventoryTransactionType } from "@/lib/db/schema";

/** Label & tipe transaksi inventori (dipakai UI, laporan, dan dashboard). */

export type InventoryTransactionTypeName = (typeof inventoryTransactionType.enumValues)[number];

export const INVENTORY_TRANSACTION_TYPE_LABELS: Record<InventoryTransactionTypeName, string> = {
  RECEIPT: "Penerimaan",
  ISSUE: "Pengeluaran",
  TRANSFER: "Transfer",
  ADJUSTMENT_IN: "Penyesuaian Masuk",
  ADJUSTMENT_OUT: "Penyesuaian Keluar",
  RESERVE: "Reservasi",
  UNRESERVE: "Batal Reservasi",
};
