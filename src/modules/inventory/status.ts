import { inventoryItemType, inventoryTransactionType } from "@/lib/db/schema";

/** Label & tipe item inventori (dipakai UI, laporan, dan dashboard). */

export type InventoryItemTypeName = (typeof inventoryItemType.enumValues)[number];
export type InventoryTransactionTypeName = (typeof inventoryTransactionType.enumValues)[number];

export const INVENTORY_ITEM_TYPE_LABELS: Record<InventoryItemTypeName, string> = {
  MATERIAL: "Material",
  FINISHED_GOOD: "Barang Jadi",
};

export const INVENTORY_TRANSACTION_TYPE_LABELS: Record<InventoryTransactionTypeName, string> = {
  RECEIPT: "Penerimaan",
  ISSUE: "Pengeluaran",
  TRANSFER: "Transfer",
  ADJUSTMENT_IN: "Penyesuaian Masuk",
  ADJUSTMENT_OUT: "Penyesuaian Keluar",
  RESERVE: "Reservasi",
  UNRESERVE: "Batal Reservasi",
};
