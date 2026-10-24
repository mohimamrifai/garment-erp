import { Banknote } from "lucide-react";
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
import type { PaymentListRow } from "../service";
import { PAYMENT_REFERENCE_LABELS, type PaymentType } from "../status";
import { PaymentTypeBadge } from "./status-badges";

export function PaymentsTable({ payments }: { payments: PaymentListRow[] }) {
  if (payments.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Banknote />
          </EmptyMedia>
          <EmptyTitle>Belum ada transaksi kas/bank</EmptyTitle>
          <EmptyDescription>
            Catat penerimaan dari faktur penjualan atau pembayaran tagihan pembelian.
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
            <TableHead>Jenis</TableHead>
            <TableHead>Dokumen</TableHead>
            <TableHead>Akun</TableHead>
            <TableHead className="text-right">Jumlah</TableHead>
            <TableHead>Catatan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-mono text-[12px] font-medium">{payment.number}</TableCell>
              <TableCell className="font-mono text-[12px] tabular-nums">
                {formatDateId(payment.date)}
              </TableCell>
              <TableCell>
                <PaymentTypeBadge type={payment.type as PaymentType} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-mono text-[12px]">
                    {payment.referenceNumber ?? payment.referenceId.slice(0, 8)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {PAYMENT_REFERENCE_LABELS[payment.referenceType] ?? payment.referenceType}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-[12px]">{payment.accountName}</TableCell>
              <TableCell className="text-right font-mono text-[12px] font-medium tabular-nums">
                {formatIdr(payment.amount)}
              </TableCell>
              <TableCell className="max-w-56 truncate text-[12px] text-muted-foreground">
                {payment.notes ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
