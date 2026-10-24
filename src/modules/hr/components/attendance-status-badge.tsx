import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { ATTENDANCE_STATUS_LABELS, type ATTENDANCE_STATUSES } from "../schemas";

type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const TONE: Record<AttendanceStatus, string> = {
  PRESENT: "border-success/30 bg-success/10 text-success",
  LATE: "border-warning/40 bg-warning/10 text-warning",
  ABSENT: "border-destructive/40 bg-destructive/10 text-destructive",
  LEAVE: "border-info/30 bg-info/10 text-info",
  SICK: "border-info/30 bg-info/10 text-info",
  HOLIDAY: "text-muted-foreground",
};

export function AttendanceStatusBadge({ status }: { status: string }) {
  const key = (status as AttendanceStatus) ?? "PRESENT";
  return (
    <Badge variant="outline" className={cn(TONE[key] ?? "")}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {ATTENDANCE_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
