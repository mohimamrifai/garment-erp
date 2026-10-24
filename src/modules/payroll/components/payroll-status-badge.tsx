import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { PAYROLL_STATUS_LABELS, type PayrollStatus } from "../status";

const TONE: Record<PayrollStatus, string> = {
  DRAFT: "text-muted-foreground",
  APPROVED: "border-info/30 bg-info/10 text-info",
  PAID: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const DOT: Record<PayrollStatus, string> = {
  DRAFT: "bg-muted-foreground",
  APPROVED: "bg-info",
  PAID: "bg-success",
  CANCELLED: "bg-destructive",
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return (
    <Badge variant="outline" className={cn(TONE[status])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[status])} />
      {PAYROLL_STATUS_LABELS[status]}
    </Badge>
  );
}
