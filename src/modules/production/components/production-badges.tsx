import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import {
  STAGE_CODE_LABELS,
  STAGE_STATUS_LABELS,
  SPK_STATUS_LABELS,
  type ProductionOrderStatus,
  type ProductionStageCode,
  type ProductionStageStatus,
} from "../status";

const SPK_TONE_CLASSES: Record<ProductionOrderStatus, string> = {
  OPEN: "text-muted-foreground",
  IN_PROGRESS: "border-brand/40 bg-brand/10 text-brand-strong",
  COMPLETED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const SPK_DOT_CLASSES: Record<ProductionOrderStatus, string> = {
  OPEN: "bg-muted-foreground",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-success",
  CANCELLED: "bg-destructive",
};

const STAGE_TONE_CLASSES: Record<ProductionStageStatus, string> = {
  PENDING: "text-muted-foreground",
  IN_PROGRESS: "border-brand/40 bg-brand/10 text-brand-strong",
  COMPLETED: "border-success/30 bg-success/10 text-success",
};

const STAGE_DOT_CLASSES: Record<ProductionStageStatus, string> = {
  PENDING: "bg-muted-foreground",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-success",
};

/** Badge status SPK dengan warna token per tahap. */
export function SpkStatusBadge({ status }: { status: ProductionOrderStatus }) {
  return (
    <Badge variant="outline" className={cn(SPK_TONE_CLASSES[status])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", SPK_DOT_CLASSES[status])} />
      {SPK_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Badge status tahap produksi (cutting → packing). */
export function StageStatusBadge({ status }: { status: ProductionStageStatus }) {
  return (
    <Badge variant="outline" className={cn(STAGE_TONE_CLASSES[status])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", STAGE_DOT_CLASSES[status])} />
      {STAGE_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Badge nama tahap produksi. */
export function StageCodeBadge({ stageCode }: { stageCode: ProductionStageCode }) {
  return (
    <Badge variant="secondary" className="font-mono text-[10px] tracking-wider uppercase">
      {STAGE_CODE_LABELS[stageCode]}
    </Badge>
  );
}
