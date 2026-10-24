import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { LEAVE_STATUS_LABELS, type LEAVE_STATUSES } from "../schemas";

type LeaveStatus = (typeof LEAVE_STATUSES)[number];

const TONE: Record<LeaveStatus, string> = {
  PENDING: "border-warning/40 bg-warning/10 text-warning",
  APPROVED: "border-success/30 bg-success/10 text-success",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  CANCELLED: "text-muted-foreground",
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const key = (status as LeaveStatus) ?? "PENDING";
  return (
    <Badge variant="outline" className={cn(TONE[key] ?? "")}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {LEAVE_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
