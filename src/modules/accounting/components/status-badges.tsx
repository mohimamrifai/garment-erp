import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import {
  DOCUMENT_PAYMENT_STATUS_LABELS,
  FISCAL_PERIOD_STATUS_LABELS,
  JOURNAL_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  type JournalStatus,
  type PaymentType,
} from "../status";

const TONE: Record<string, string> = {
  DRAFT: "text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  REVERSED: "border-warning/40 bg-warning/10 text-warning",
  PAID: "border-success/30 bg-success/10 text-success",
  UNPAID: "border-warning/40 bg-warning/10 text-warning",
  PARTIALLY_PAID: "border-info/30 bg-info/10 text-info",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
  OPEN: "border-info/30 bg-info/10 text-info",
  CLOSED: "text-muted-foreground",
  RECEIPT: "border-success/30 bg-success/10 text-success",
  PAYMENT: "border-info/30 bg-info/10 text-info",
};

function DotBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <Badge variant="outline" className={cn(tone)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

export function JournalStatusBadge({ status }: { status: JournalStatus }) {
  return <DotBadge label={JOURNAL_STATUS_LABELS[status]} tone={TONE[status] ?? ""} />;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <DotBadge
      label={DOCUMENT_PAYMENT_STATUS_LABELS[status] ?? status}
      tone={TONE[status] ?? ""}
    />
  );
}

export function PaymentTypeBadge({ type }: { type: PaymentType }) {
  return <DotBadge label={PAYMENT_TYPE_LABELS[type]} tone={TONE[type] ?? ""} />;
}

export function FiscalPeriodStatusBadge({ status }: { status: string }) {
  return (
    <DotBadge
      label={FISCAL_PERIOD_STATUS_LABELS[status] ?? status}
      tone={TONE[status] ?? ""}
    />
  );
}
