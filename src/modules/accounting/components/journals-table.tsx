import Link from "next/link";
import { ScrollText } from "lucide-react";
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
import { formatDateId } from "@/lib/utils/dates";
import type { JournalListRow } from "../service";
import { SOURCE_TYPE_LABELS, type JournalStatus } from "../status";
import { JournalStatusBadge } from "./status-badges";

export function JournalsTable({ journals }: { journals: JournalListRow[] }) {
  if (journals.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ScrollText />
          </EmptyMedia>
          <EmptyTitle>Belum ada jurnal</EmptyTitle>
          <EmptyDescription>
            Jurnal otomatis dibuat dari transaksi penjualan, pembelian, produksi, dan payroll.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Nomor</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead>Sumber</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {journals.map((journal) => (
            <TableRow key={journal.id}>
              <TableCell>
                <Link
                  href={`/accounting/journals/${journal.id}`}
                  className="font-mono text-[12px] font-medium underline underline-offset-4 hover:text-brand-strong"
                >
                  {journal.number}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-[12px] tabular-nums">
                {formatDateId(journal.date)}
              </TableCell>
              <TableCell className="max-w-80 truncate text-[13px]">{journal.description}</TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {SOURCE_TYPE_LABELS[journal.sourceType] ?? journal.sourceType}
              </TableCell>
              <TableCell>
                <JournalStatusBadge status={journal.status as JournalStatus} />
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                {formatIdr(journal.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
