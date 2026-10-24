import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDateTimeId } from "@/lib/utils/dates";
import { ClosePeriodDialog } from "@/modules/accounting/components/close-period-dialog";
import { FiscalPeriodStatusBadge } from "@/modules/accounting/components/status-badges";
import { listFiscalPeriods } from "@/modules/accounting/service";

export const metadata: Metadata = { title: "Tutup Buku" };

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export default function PeriodsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tutup Buku"
        description="Buka dan tutup periode akuntansi bulanan. Periode tertutup tidak menerima jurnal baru."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PeriodsSection />
      </Suspense>
    </div>
  );
}

async function PeriodsSection() {
  const actor = await requirePagePermission("accounting.view");
  const periods = await listFiscalPeriods();
  const canClose = can(actor.roles, "accounting.close");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          {periods.length} periode tercatat · {periods.filter((period) => period.status === "CLOSED").length}{" "}
          ditutup
        </p>
        {canClose ? <ClosePeriodDialog /> : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Periode</TableHead>
              <TableHead>Mulai</TableHead>
              <TableHead>Selesai</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ditutup pada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CalendarCheck className="size-5" />
                    <span className="text-[13px]">
                      Belum ada periode. Periode dibuat otomatis saat jurnal pertama diposting.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">
                    {MONTHS[period.month - 1]} {period.year}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] tabular-nums">
                    {period.startDate}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] tabular-nums">
                    {period.endDate}
                  </TableCell>
                  <TableCell>
                    <FiscalPeriodStatusBadge status={period.status} />
                  </TableCell>
                  <TableCell className="font-mono text-[12px] tabular-nums">
                    {period.closedAt ? formatDateTimeId(period.closedAt) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
