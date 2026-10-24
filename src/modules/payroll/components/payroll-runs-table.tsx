import Link from "next/link";
import { Wallet } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIdr } from "@/lib/utils/currency";
import type { PayrollRunListRow } from "../service";
import { PayrollStatusBadge } from "./payroll-status-badge";
import type { PayrollStatus } from "../status";

export function PayrollRunsTable({ runs }: { runs: PayrollRunListRow[] }) {
  if (runs.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wallet />
          </EmptyMedia>
          <EmptyTitle>Belum ada payroll</EmptyTitle>
          <EmptyDescription>
            Buat payroll bulanan setelah data absensi dan cuti karyawan siap.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Nomor</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Karyawan</TableHead>
            <TableHead className="text-right">Bruto</TableHead>
            <TableHead className="text-right">Potongan</TableHead>
            <TableHead className="text-right">Neto</TableHead>
            <TableHead className="text-right">Kontribusi Perusahaan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link
                  href={`/payroll/${run.id}`}
                  className="font-mono text-[12px] font-medium underline underline-offset-4 hover:text-brand-strong"
                >
                  {run.number}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-[12px] tabular-nums">{run.period}</TableCell>
              <TableCell>
                <PayrollStatusBadge status={run.status as PayrollStatus} />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {run.employeeCount}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatIdr(run.totalGross)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatIdr(run.totalDeductions)}
              </TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">
                {formatIdr(run.totalNet)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatIdr(run.totalEmployerContributions)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
