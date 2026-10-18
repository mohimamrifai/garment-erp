import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { QC_RESULT_LABELS, type QcResult } from "@/modules/production/status";

const QC_TONE_CLASSES: Record<QcResult, string> = {
  PENDING: "text-muted-foreground",
  PASS: "border-success/30 bg-success/10 text-success",
  FAIL: "border-destructive/40 bg-destructive/10 text-destructive",
  REWORK: "border-warning/40 bg-warning/10 text-warning",
};

const QC_DOT_CLASSES: Record<QcResult, string> = {
  PENDING: "bg-muted-foreground",
  PASS: "bg-success",
  FAIL: "bg-destructive",
  REWORK: "bg-warning",
};

/** Badge hasil inspeksi QC: menunggu keputusan, lolos, gagal, atau rework. */
export function QcResultBadge({ result }: { result: QcResult }) {
  return (
    <Badge variant="outline" className={cn(QC_TONE_CLASSES[result])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", QC_DOT_CLASSES[result])} />
      {QC_RESULT_LABELS[result]}
    </Badge>
  );
}
