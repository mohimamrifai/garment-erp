import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { SO_STATUS_LABELS, type SalesOrderStatus } from "../status";

const TONE_CLASSES: Record<SalesOrderStatus, string> = {
  DRAFT: "text-muted-foreground",
  CONFIRMED: "border-brand/40 bg-brand/10 text-brand-strong",
  IN_PRODUCTION: "border-warning/40 bg-warning/10 text-warning",
  READY_TO_SHIP: "border-info/40 bg-info/10 text-info",
  PARTIALLY_SHIPPED: "border-info/40 bg-info/10 text-info",
  COMPLETED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const DOT_CLASSES: Record<SalesOrderStatus, string> = {
  DRAFT: "bg-muted-foreground",
  CONFIRMED: "bg-brand",
  IN_PRODUCTION: "bg-warning",
  READY_TO_SHIP: "bg-info",
  PARTIALLY_SHIPPED: "bg-info",
  COMPLETED: "bg-success",
  CANCELLED: "bg-destructive",
};

/** Badge status dokumen sales order dengan warna token per tahap. */
export function SoStatusBadge({ status }: { status: SalesOrderStatus }) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASSES[status])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT_CLASSES[status])} />
      {SO_STATUS_LABELS[status]}
    </Badge>
  );
}
