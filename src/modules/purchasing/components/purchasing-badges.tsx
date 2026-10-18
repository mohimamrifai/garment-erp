import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import {
  PO_STATUS_LABELS,
  RECEIPT_STATUS_LABELS,
  type MaterialReceiptStatus,
  type PurchaseOrderStatus,
} from "../status";

const PO_TONE_CLASSES: Record<PurchaseOrderStatus, string> = {
  DRAFT: "text-muted-foreground",
  ORDERED: "border-brand/40 bg-brand/10 text-brand-strong",
  PARTIALLY_RECEIVED: "border-warning/40 bg-warning/10 text-warning",
  RECEIVED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const PO_DOT_CLASSES: Record<PurchaseOrderStatus, string> = {
  DRAFT: "bg-muted-foreground",
  ORDERED: "bg-brand",
  PARTIALLY_RECEIVED: "bg-warning",
  RECEIVED: "bg-success",
  CANCELLED: "bg-destructive",
};

const RECEIPT_TONE_CLASSES: Record<MaterialReceiptStatus, string> = {
  DRAFT: "text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const RECEIPT_DOT_CLASSES: Record<MaterialReceiptStatus, string> = {
  DRAFT: "bg-muted-foreground",
  POSTED: "bg-success",
  CANCELLED: "bg-destructive",
};

/** Badge status purchase order dengan warna token per tahap. */
export function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <Badge variant="outline" className={cn(PO_TONE_CLASSES[status])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", PO_DOT_CLASSES[status])} />
      {PO_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Badge status penerimaan material. */
export function ReceiptStatusBadge({ status }: { status: MaterialReceiptStatus }) {
  return (
    <Badge variant="outline" className={cn(RECEIPT_TONE_CLASSES[status])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", RECEIPT_DOT_CLASSES[status])} />
      {RECEIPT_STATUS_LABELS[status]}
    </Badge>
  );
}
