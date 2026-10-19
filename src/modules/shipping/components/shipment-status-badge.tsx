import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "../status";

const TONE_CLASSES: Record<ShipmentStatus, string> = {
  DRAFT: "text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const DOT_CLASSES: Record<ShipmentStatus, string> = {
  DRAFT: "bg-muted-foreground",
  POSTED: "bg-success",
  CANCELLED: "bg-destructive",
};

/** Badge status surat jalan. */
export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASSES[status])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT_CLASSES[status])} />
      {SHIPMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
