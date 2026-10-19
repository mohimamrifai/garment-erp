import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { InventoryItemTypeName, InventoryTransactionListRow } from "../service";
import { INVENTORY_TRANSACTION_TYPE_LABELS } from "../status";

export const TRANSACTION_TYPE_LABELS = INVENTORY_TRANSACTION_TYPE_LABELS;

const TYPE_TONE_CLASSES: Record<InventoryTransactionListRow["transactionType"], string> = {
  RECEIPT: "border-success/30 bg-success/10 text-success",
  ISSUE: "border-info/40 bg-info/10 text-info",
  TRANSFER: "border-info/40 bg-info/10 text-info",
  ADJUSTMENT_IN: "border-success/30 bg-success/10 text-success",
  ADJUSTMENT_OUT: "border-warning/40 bg-warning/10 text-warning",
  RESERVE: "text-muted-foreground",
  UNRESERVE: "text-muted-foreground",
};

const TYPE_DOT_CLASSES: Record<InventoryTransactionListRow["transactionType"], string> = {
  RECEIPT: "bg-success",
  ISSUE: "bg-info",
  TRANSFER: "bg-info",
  ADJUSTMENT_IN: "bg-success",
  ADJUSTMENT_OUT: "bg-warning",
  RESERVE: "bg-muted-foreground",
  UNRESERVE: "bg-muted-foreground",
};

/** Badge jenis mutasi stok dengan warna token per arah. */
export function TransactionTypeBadge({
  type,
}: {
  type: InventoryTransactionListRow["transactionType"];
}) {
  return (
    <Badge variant="outline" className={cn(TYPE_TONE_CLASSES[type])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", TYPE_DOT_CLASSES[type])} />
      {TRANSACTION_TYPE_LABELS[type]}
    </Badge>
  );
}

/** Badge tipe item inventori: material atau barang jadi. */
export function ItemTypeBadge({ itemType }: { itemType: InventoryItemTypeName }) {
  return (
    <Badge variant="secondary" className="font-mono text-[10px] tracking-wider uppercase">
      {itemType === "MATERIAL" ? "Material" : "Barang Jadi"}
    </Badge>
  );
}
